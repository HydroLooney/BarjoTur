-- 51_isochrones_van.sql, isochrones VAN depuis chaque base (C04). Graphe Ruteplan, pgr_drivingDistance.
-- Seuils 30/60 min (bornés pour le compute ; 60 min = rayon de rayonnement clé). Une driving-distance par base (à 3600 s),
-- puis polygone par seuil = concave hull des noeuds atteints RÉDUITS sur grille 500 m (borne le hull, résolution web OK).
-- Stocke mcda2.isochrone_van + vue diffusion.v_web_isochrones (4326). NON destructif.
-- Usage : PGOPTIONS="-c client_min_messages=warning" psql -h localhost -p 5433 -d norvege_routing -v ON_ERROR_STOP=1 -f calc/recette/51_isochrones_van.sql
\set ON_ERROR_STOP on

DROP TABLE IF EXISTS mcda2.isochrone_van;
CREATE TABLE mcda2.isochrone_van(base_id int, mode text DEFAULT 'van', seuil_min int, n_noeuds int, geom geometry(Geometry,25833));

DO $$
DECLARE b RECORD; s int;
BEGIN
  FOR b IN SELECT brn.base_id, brn.node_ruteplan FROM staging.base_ruteplan_node brn ORDER BY brn.base_id LOOP
    DROP TABLE IF EXISTS _dd;
    CREATE TEMP TABLE _dd AS
      SELECT d.node, d.agg_cost FROM pgr_drivingDistance(
        'SELECT id, source, target, cost_s AS cost, reverse_cost_s AS reverse_cost FROM staging.ways_ruteplan',
        b.node_ruteplan, 3600, directed:=true) d;
    FOREACH s IN ARRAY ARRAY[1800,3600] LOOP
      INSERT INTO mcda2.isochrone_van(base_id, seuil_min, n_noeuds, geom)
      SELECT b.base_id, s/60, count(*),
        CASE WHEN count(*)>=3 THEN ST_ConcaveHull(ST_Collect(g), 0.4, false) ELSE ST_ConvexHull(ST_Collect(g)) END
      FROM (
        SELECT DISTINCT ST_SnapToGrid(rn.geom, 500) g
        FROM _dd dd JOIN staging.ruteplan_node rn ON rn.node = dd.node
        WHERE dd.agg_cost <= s
      ) x;
    END LOOP;
  END LOOP;
END $$;
CREATE INDEX ON mcda2.isochrone_van USING gist(geom);
CREATE INDEX ON mcda2.isochrone_van(base_id, seuil_min);
COMMENT ON TABLE mcda2.isochrone_van IS 'Isochrones van depuis bases (C04, 14/08), Ruteplan pgr_drivingDistance, hull des noeuds réduits grille 500 m. Script 51_.';

DROP VIEW IF EXISTS diffusion.v_web_isochrones;
CREATE VIEW diffusion.v_web_isochrones AS
SELECT base_id, mode, seuil_min, n_noeuds,
       ST_Transform(ST_SimplifyPreserveTopology(geom, 100), 4326) AS geom
FROM mcda2.isochrone_van WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom);
COMMENT ON VIEW diffusion.v_web_isochrones IS 'C04 : isochrones multimodales pour le web (4326 simplifié). Van posé ; pieton/rando à venir. Script 51_.';

\echo '== isochrones van : volumétrie + aire moyenne (km2) par seuil =='
SELECT seuil_min, count(*) n, round(avg(ST_Area(geom)/1e6)::numeric,0) aire_km2_moy, count(*) FILTER (WHERE geom IS NULL OR ST_IsEmpty(geom)) vides
FROM mcda2.isochrone_van GROUP BY seuil_min ORDER BY seuil_min;
\echo '== exemple base 1 =='
SELECT base_id, seuil_min, n_noeuds, round((ST_Area(geom)/1e6)::numeric,0) km2 FROM mcda2.isochrone_van WHERE base_id=1 ORDER BY seuil_min;
