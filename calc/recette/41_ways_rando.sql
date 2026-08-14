-- 41_ways_rando.sql, réseau RANDO routable depuis Turrutebasen fotrute (M091 item 7).
-- pgRouting 4.0.1 n'a plus createTopology/nodeNetwork : NODING MANUEL par snap des extrémités sur grille 0,5 m → node_id
-- (les segments Turrutebasen se touchent aux jonctions par sommets coïncidents). source/target = node des extrémités.
-- Coût = longueur / vitesse rando PLAT famille (routing_params randonnee vitesse_plat_kmh, = famille sur le plat).
-- Bidirectionnel. Difficulté DNT (gradering la plus sévère). D+ pente = à l'arrivée du DEM (T047, recoût par arête).
-- Usage : PGOPTIONS="-c client_min_messages=warning" psql -h localhost -p 5433 -d norvege_routing -v ON_ERROR_STOP=1 -f calc/recette/41_ways_rando.sql

\set ON_ERROR_STOP on
\set S turogfriluftsruter_9fb60114b8f347e69d38b16e28f25d33

-- Vitesse marche plat famille (m/s).
CREATE TEMP TABLE _vr AS SELECT (SELECT valeur FROM mcda2.routing_params WHERE profil='randonnee' AND param='vitesse_plat_kmh')/3.6 AS ms;

DROP TABLE IF EXISTS mcda2.ways_rando;
CREATE TABLE mcda2.ways_rando AS
WITH e AS (
  SELECT f.objid AS id, f.senterlinje AS geom, ST_Length(f.senterlinje) AS len,
    ST_X(ST_SnapToGrid(ST_StartPoint(f.senterlinje),0.5)) sx, ST_Y(ST_SnapToGrid(ST_StartPoint(f.senterlinje),0.5)) sy,
    ST_X(ST_SnapToGrid(ST_EndPoint(f.senterlinje),0.5))   ex, ST_Y(ST_SnapToGrid(ST_EndPoint(f.senterlinje),0.5))   ey
  FROM :"S".fotrute f WHERE f.senterlinje IS NOT NULL AND ST_Length(f.senterlinje)>0
),
nd AS (
  SELECT x, y, row_number() OVER (ORDER BY x,y) AS node_id
  FROM (SELECT sx x, sy y FROM e UNION SELECT ex, ey FROM e) u
),
diff AS (
  SELECT fotrute_fk, max(CASE upper(coalesce(gradering,''))
      WHEN 'S' THEN 4 WHEN 'R' THEN 3 WHEN 'B' THEN 2 WHEN 'G' THEN 1 ELSE 0 END) sev
  FROM :"S".fotruteinfo GROUP BY fotrute_fk
)
SELECT e.id, s.node_id AS source, t.node_id AS target,
  round((e.len/(SELECT ms FROM _vr))::numeric,1) AS cost_s,
  round((e.len/(SELECT ms FROM _vr))::numeric,1) AS reverse_cost_s,     -- bidirectionnel
  round(e.len::numeric,1) AS length_m,
  CASE coalesce(d.sev,0) WHEN 4 THEN 'expert' WHEN 3 THEN 'difficile' WHEN 2 THEN 'moyen' WHEN 1 THEN 'facile' ELSE 'non gradé' END AS difficulte,
  e.geom
FROM e
JOIN nd s ON s.x=e.sx AND s.y=e.sy
JOIN nd t ON t.x=e.ex AND t.y=e.ey
LEFT JOIN diff d ON d.fotrute_fk=e.id;
CREATE INDEX ON mcda2.ways_rando(source);
CREATE INDEX ON mcda2.ways_rando(target);
CREATE INDEX ON mcda2.ways_rando USING gist(geom);
COMMENT ON TABLE mcda2.ways_rando IS
 'Réseau rando routable Turrutebasen (14/08), noding manuel snap 0,5 m. Coût Tobler PLAT famille (routing_params). '
 'D+ pente à recalculer au DEM (T047). Difficulté DNT. Script 41_.';

\echo '== volumétrie (attendu ~139241) + auto-boucles =='
SELECT count(*) aretes, count(*) FILTER (WHERE source=target) auto_boucles,
       (SELECT count(*) FROM (SELECT source FROM mcda2.ways_rando UNION SELECT target FROM mcda2.ways_rando) u) noeuds
FROM mcda2.ways_rando;
\echo '== connectivité : composantes (fragmentation NORMALE pour des sentiers épars) =='
SELECT count(*) n_composantes, max(cnt) plus_grande,
       count(*) FILTER (WHERE cnt=1) singletons,
       round(100.0*sum(cnt) FILTER (WHERE cnt>50)/sum(cnt),1) pct_noeuds_regions
FROM (
  SELECT component, count(*) cnt
  FROM pgr_connectedComponents('SELECT id, source, target, cost_s AS cost, reverse_cost_s AS reverse_cost FROM mcda2.ways_rando')
  GROUP BY component
) c;
\echo '== difficulté =='
SELECT difficulte, count(*), round((sum(length_m)/1000)::numeric,0) km FROM mcda2.ways_rando GROUP BY difficulte ORDER BY count(*) DESC;
