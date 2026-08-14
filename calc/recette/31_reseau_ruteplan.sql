-- 31_reseau_ruteplan.sql, graphe van routable NATIF depuis Ruteplan (source autoritative Guillaume, M064/M065).
-- Remplace le graphe OSM ways_van (maillage ferry v2 synthétique + snapping NVDB fragmentant, 7568/10712 joignables).
-- Ruteplan = topologie native fromnode/tonode (routes + ferries + tunnels déjà câblés, aucun snapping), oneway,
-- restrictions, drivetime officiel. R1 CONSTAT : le drivetime ferry de Ruteplan est quasi nul (avg 0,3 min, max 3,4 min
-- pour des liens jusqu'à 37 km) = NON autoritatif pour la traversée. On garde donc la TOPOLOGIE Ruteplan et on injecte
-- le TEMPS ferry réel depuis NVDB ferjesamband (699/699 liens Ruteplan appariés à <800 m après ST_Transform).
-- Unités : Ruteplan drivetime = MINUTES (ratio médian dt/(len/vitesse) = 1,47) -> cost_s = drivetime*60.
-- Écrit en STAGING, NON destructif, NON promu. Snappe les 104 bases sur les noeuds Ruteplan et teste la connectivité
-- AVANT toute matrice (preuve que Ruteplan corrige la fragmentation). La matrice + re-gate C16 + delta suivent (32_).
-- Usage : PGOPTIONS="-c client_min_messages=warning" psql -h localhost -p 5433 -d norvege_routing -v ON_ERROR_STOP=1 -f calc/recette/31_reseau_ruteplan.sql

\set ON_ERROR_STOP on

-- 0. Temps ferry réel NVDB, projeté en 25833 + index (source du coût ferry).
DROP TABLE IF EXISTS staging.nvdb_ferry_25833;
CREATE TABLE staging.nvdb_ferry_25833 AS
SELECT fid, streetname, drivetime_fw, drivetime_bw, ST_Transform(geom, 25833) AS geom
FROM staging.nvdb_ferry_link;
CREATE INDEX ON staging.nvdb_ferry_25833 USING gist(geom);

-- 1. Graphe routable Ruteplan : id=linkid, source/target=fromnode/tonode natifs.
--    Coût en secondes. oneway B=bidirectionnel, FT=aller seul (reverse interdit -1), TF=retour seul (cost interdit -1).
--    Ferry : temps NVDB réel (min*60) dans les deux sens, oneway ignoré (les bacs vont dans les deux sens).
DROP TABLE IF EXISTS staging.ways_ruteplan;
CREATE TABLE staging.ways_ruteplan AS
SELECT
  r.linkid                          AS id,
  r.fromnode                        AS source,
  r.tonode                          AS target,
  CASE
    WHEN r.isferry = 1 THEN round((nf.dt_fw * 60.0)::numeric, 1)
    WHEN r.oneway = 'TF' THEN -1                              -- sens aller interdit
    ELSE round((r.drivetime_fw * 60.0)::numeric, 1)
  END                               AS cost_s,
  CASE
    WHEN r.isferry = 1 THEN round((nf.dt_bw * 60.0)::numeric, 1)
    WHEN r.oneway = 'FT' THEN -1                              -- sens retour interdit
    ELSE round((r.drivetime_bw * 60.0)::numeric, 1)
  END                               AS reverse_cost_s,
  round(r.length::numeric, 1)       AS length_m,
  (r.isferry = 1)                   AS is_ferry,
  (r.istunnel = 1)                  AS is_tunnel,
  r.geom                            AS geom
FROM staging.ruteplan_links r
LEFT JOIN LATERAL (
  SELECT n.drivetime_fw AS dt_fw, n.drivetime_bw AS dt_bw
  FROM staging.nvdb_ferry_25833 n
  ORDER BY n.geom <-> ST_LineInterpolatePoint(r.geom, 0.5)
  LIMIT 1
) nf ON r.isferry = 1
WHERE r.fromnode IS NOT NULL AND r.tonode IS NOT NULL AND r.geom IS NOT NULL;

CREATE INDEX ON staging.ways_ruteplan(source);
CREATE INDEX ON staging.ways_ruteplan(target);
CREATE INDEX ON staging.ways_ruteplan(id);

-- 2. Noeuds Ruteplan (endpoints des liens) pour snapper les bases.
DROP TABLE IF EXISTS staging.ruteplan_node;
CREATE TABLE staging.ruteplan_node AS
SELECT node, ST_SetSRID(ST_MakePoint(min(x), min(y)), 25833) AS geom
FROM (
  SELECT source AS node, ST_X(ST_StartPoint(geom)) x, ST_Y(ST_StartPoint(geom)) y FROM staging.ways_ruteplan
  UNION ALL
  SELECT target AS node, ST_X(ST_EndPoint(geom)) x, ST_Y(ST_EndPoint(geom)) y FROM staging.ways_ruteplan
) e
GROUP BY node;
CREATE INDEX ON staging.ruteplan_node USING gist(geom);
CREATE INDEX ON staging.ruteplan_node(node);

-- 3. Snapping des 104 bases sur le noeud Ruteplan le plus proche (bases en 4326 -> 25833).
DROP TABLE IF EXISTS staging.base_ruteplan_node;
CREATE TABLE staging.base_ruteplan_node AS
SELECT b.base_id, b.lon, b.lat,
       n.node AS node_ruteplan,
       round(ST_Distance(ST_Transform(b.geom,25833), n.geom)::numeric, 0) AS snap_m
FROM mcda2.bases_v2 b
CROSS JOIN LATERAL (
  SELECT node, geom FROM staging.ruteplan_node
  ORDER BY geom <-> ST_Transform(b.geom, 25833)
  LIMIT 1
) n;
CREATE INDEX ON staging.base_ruteplan_node(base_id);

-- 4. Vérifications topologie + snapping.
\echo '== A. Volumétrie graphe (liens, ferries, tunnels, sens uniques) =='
SELECT count(*) liens,
       count(*) FILTER (WHERE is_ferry) ferries,
       count(*) FILTER (WHERE is_tunnel) tunnels,
       count(*) FILTER (WHERE cost_s = -1 OR reverse_cost_s = -1) sens_uniques,
       count(*) FILTER (WHERE is_ferry AND (cost_s IS NULL OR cost_s <= 0)) ferry_sans_temps
FROM staging.ways_ruteplan;
\echo '== B. Coût ferry injecté depuis NVDB (min) =='
SELECT count(*) ferry, round(min(cost_s/60.0)::numeric,1) min_min, round(avg(cost_s/60.0)::numeric,1) avg_min, round(max(cost_s/60.0)::numeric,1) max_min
FROM staging.ways_ruteplan WHERE is_ferry;
\echo '== C. Snapping bases (max snap attendu petit ; alerte si > 2000 m) =='
SELECT count(*) bases, round(avg(snap_m)::numeric,0) avg_m, max(snap_m) max_m,
       count(*) FILTER (WHERE snap_m > 2000) bases_snap_loin
FROM staging.base_ruteplan_node;
\echo '== D. Bases mal snappées (>2000 m) =='
SELECT base_id, lon, lat, snap_m FROM staging.base_ruteplan_node WHERE snap_m > 2000 ORDER BY snap_m DESC LIMIT 12;

-- 5. Connectivité : reachabilité dirigée depuis 1 base ouest vers toutes les autres (preuve anti-fragmentation).
\echo '== E. Reachabilité dirigée (dijkstra one-to-many depuis une base ouest) — attendu ~103 =='
DROP TABLE IF EXISTS staging.ruteplan_reach_test;
CREATE TABLE staging.ruteplan_reach_test AS
WITH src AS (
  SELECT brn.node_ruteplan FROM staging.base_ruteplan_node brn
  JOIN mcda2.bases_v2 b ON b.base_id = brn.base_id
  WHERE b.lon < 6 ORDER BY b.lon LIMIT 1
)
SELECT d.end_vid, d.agg_cost
FROM pgr_dijkstra(
  'SELECT id, source, target, cost_s AS cost, reverse_cost_s AS reverse_cost FROM staging.ways_ruteplan',
  (SELECT node_ruteplan FROM src),
  (SELECT array_agg(node_ruteplan) FROM staging.base_ruteplan_node),
  directed := true) d;
SELECT (SELECT count(*)-1 FROM staging.base_ruteplan_node) bases_cibles,
       count(*) FILTER (WHERE agg_cost > 0) atteintes,
       count(*) FILTER (WHERE agg_cost > 0 AND end_vid IN (SELECT node_ruteplan FROM staging.base_ruteplan_node brn JOIN mcda2.bases_v2 b ON b.base_id=brn.base_id WHERE b.lon<6)) ouest_atteintes,
       (SELECT count(*) FROM mcda2.bases_v2 WHERE lon<6) ouest_total
FROM staging.ruteplan_reach_test;
