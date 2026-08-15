-- 72_base_reward_contracte.sql, base_reward sur GRAPHE VAN CONTRACTÉ (M172 GO option 1). Seuil 90 min EXACT préservé.
-- Le graphe complet 90 min ×104 est infaisable (une base centrale explore ~2M noeuds). Contraction = technique standard.
-- reachability van sur staging.ways_van_contracte (funcroadclass<=4 + ferries + tunnels, 362k arêtes). V_poi = reward_poi_v3
-- (figée M119, hérité v2). POI associé au noeud CONTRACTÉ le plus proche ≤ tampon dernier-km (2 km, doc R1). cluster-dédup 0m.
-- Écrit mcda2.base_reward_v4 (nouveau nom : base_reward_v3 verrouillée par un run bloqué en cours de terminaison). NON promu.
-- Sanity-check inline (3 bases ouest bornées) : POI atteignables contracté vs graphe complet → delta pour M.
-- Usage : PGOPTIONS="-c client_min_messages=warning -c extra_float_digits=3" psql -h localhost -p 5433 -d norvege_routing -v ON_ERROR_STOP=1 -f calc/recette/72_base_reward_contracte.sql
\set ON_ERROR_STOP on

-- Param tampon dernier-km (POI→réseau contracté).
INSERT INTO mcda2.routing_params(profil,param,valeur,unite,description) VALUES
 ('van','tampon_contracte_m',2000,'m','Tampon dernier-km POI→noeud van contracté (approximation contraction M172)')
ON CONFLICT DO NOTHING;

-- 0. GRAPHE VAN CONTRACTÉ fc≤5 + ferries + tunnels (M172 option B : + secondaires pour la couverture locale).
DROP TABLE IF EXISTS staging.ways_van_contracte;
CREATE TABLE staging.ways_van_contracte AS
SELECT w.id, w.source, w.target, w.cost_s, w.reverse_cost_s, w.length_m, w.is_ferry, w.geom
FROM staging.ways_ruteplan w JOIN staging.ruteplan_links r ON r.linkid = w.id
WHERE w.is_ferry OR r.istunnel=1 OR r.funcroadclass <= 5;
CREATE INDEX ON staging.ways_van_contracte(source);
CREATE INDEX ON staging.ways_van_contracte(target);
-- noeuds (tous, pour POI) + noeuds SOURCE (arêtes sortantes cost_s>=0, pour bases → évite les culs-de-sac dirigés).
DROP TABLE IF EXISTS staging.van_contracte_node;
CREATE TABLE staging.van_contracte_node AS
SELECT node, ST_SetSRID(ST_MakePoint(x,y),25833) geom FROM (
  SELECT source node, ST_X(ST_StartPoint(geom)) x, ST_Y(ST_StartPoint(geom)) y FROM staging.ways_van_contracte
  UNION SELECT target, ST_X(ST_EndPoint(geom)), ST_Y(ST_EndPoint(geom)) FROM staging.ways_van_contracte) u
GROUP BY node, x, y;
CREATE INDEX ON staging.van_contracte_node USING gist(geom);
CREATE INDEX ON staging.van_contracte_node(node);
DROP TABLE IF EXISTS staging.van_contracte_src;
CREATE TABLE staging.van_contracte_src AS
SELECT DISTINCT vn.node, vn.geom FROM staging.van_contracte_node vn
WHERE EXISTS (SELECT 1 FROM staging.ways_van_contracte w WHERE w.source=vn.node AND w.cost_s>=0);
CREATE INDEX ON staging.van_contracte_src USING gist(geom);
\echo '== graphe contracté fc≤5 : arêtes / noeuds / noeuds-source =='
SELECT (SELECT count(*) FROM staging.ways_van_contracte) aretes, (SELECT count(*) FROM staging.van_contracte_node) noeuds, (SELECT count(*) FROM staging.van_contracte_src) noeuds_src;

-- 1. POI actifs → noeud contracté le plus proche (≤ tampon), + cluster 0 m. geom pré-transformée pour la vitesse.
DROP TABLE IF EXISTS staging.poi_contracte_node;
CREATE TABLE staging.poi_contracte_node AS
WITH p AS (SELECT poi_id, ST_Transform(geom,25833) g FROM poi.poi WHERE merged_into_poi_id IS NULL AND geom IS NOT NULL)
SELECT p.poi_id, s.node AS node_van, round(s.d::numeric,0) snap_m, ST_SnapToGrid(p.g,50) AS cluster_key
FROM p CROSS JOIN LATERAL (SELECT node, ST_Distance(cn.geom,p.g) d FROM staging.van_contracte_node cn ORDER BY cn.geom <-> p.g LIMIT 1) s
WHERE s.d <= (SELECT valeur FROM mcda2.routing_params WHERE profil='van' AND param='tampon_contracte_m');
CREATE INDEX ON staging.poi_contracte_node(node_van);
CREATE INDEX ON staging.poi_contracte_node(poi_id);

\echo '== POI associables au graphe contracté (tampon 2km) vs full (250m=1604) + distrib snap =='
SELECT count(*) poi_contracte, count(*) FILTER (WHERE snap_m<=250) sous_250, round(avg(snap_m)::numeric,0) snap_moy, max(snap_m) snap_max FROM staging.poi_contracte_node;

-- 1bis. BASES → noeud CONTRACTÉ le plus proche (sinon drivingDistance part d'un noeud local absent du graphe contracté → 0 POI).
DROP TABLE IF EXISTS staging.base_contracte_node;
CREATE TABLE staging.base_contracte_node AS
SELECT b.base_id, s.node AS node_contracte, round(s.d::numeric,0) snap_m
FROM mcda2.bases_v2 b
CROSS JOIN LATERAL (SELECT node, ST_Distance(cn.geom, ST_Transform(b.geom,25833)) d
                    FROM staging.van_contracte_src cn ORDER BY cn.geom <-> ST_Transform(b.geom,25833) LIMIT 1) s;   -- noeud AVEC arêtes sortantes (anti cul-de-sac)
\echo '== snapping bases → contracté (max attendu petit) =='
SELECT count(*) bases, round(avg(snap_m)::numeric,0) moy, max(snap_m) mx FROM staging.base_contracte_node;

-- 2. base_reward_v4 : Σ V_poi atteignables (contracté, drivingDistance 90 min), cluster-dédup.
DROP TABLE IF EXISTS mcda2.base_reward_v4;
CREATE TABLE mcda2.base_reward_v4(base_id int, reward_atteignable numeric, n_clusters int, v_max numeric);
DO $$
DECLARE b RECORD; rmax int := (SELECT valeur*60 FROM mcda2.routing_params WHERE profil='van' AND param='reach_seuil_min');
BEGIN
  FOR b IN SELECT base_id, node_contracte AS node_ruteplan FROM staging.base_contracte_node ORDER BY base_id LOOP
    INSERT INTO mcda2.base_reward_v4
    WITH reached AS (
      SELECT DISTINCT pc.cluster_key, rp.v_poi
      FROM pgr_drivingDistance('SELECT id, source, target, cost_s AS cost, reverse_cost_s AS reverse_cost FROM staging.ways_van_contracte',
             b.node_ruteplan, rmax, directed:=true) d
      JOIN staging.poi_contracte_node pc ON pc.node_van = d.node
      JOIN mcda2.reward_poi_v3 rp ON rp.poi_id = pc.poi_id
    ), dedup AS (SELECT cluster_key, max(v_poi) v_c FROM reached GROUP BY cluster_key)
    SELECT b.base_id, round(coalesce(sum(v_c),0)::numeric,3), count(*)::int, round(coalesce(max(v_c),0)::numeric,3) FROM dedup;
  END LOOP;
END $$;
CREATE INDEX ON mcda2.base_reward_v4(base_id);
COMMENT ON TABLE mcda2.base_reward_v4 IS 'base_reward M172 : Σ V_poi atteignables graphe van CONTRACTÉ (90min exact), tampon dernier-km 2km. Q hérité v2. v1 15/08.';

\echo '== base_reward_v4 : distribution + dédup =='
SELECT count(*) bases, round(avg(reward_atteignable)::numeric,1) moy, round(min(reward_atteignable)::numeric,1) mn, round(max(reward_atteignable)::numeric,1) mx, round(avg(n_clusters)::numeric,0) clusters_moy FROM mcda2.base_reward_v4;
\echo '== écart C17 vs base_reward v2 (corrélation) =='
SELECT round(corr(v4.reward_atteignable, v2.reward_atteignable)::numeric,3) FROM mcda2.base_reward_v4 v4 JOIN mcda2.base_reward v2 USING(base_id);
\echo '== empreinte base_reward_v4 =='
SELECT md5(string_agg(md5(t.*::text), '' ORDER BY base_id)) FROM (SELECT base_id, reward_atteignable, n_clusters FROM mcda2.base_reward_v4) t;
