-- 76_base_poi_reachable.sql, MATRICE base→POI atteignable (fondation facility-location bases idéales, M178).
-- Pour chaque base : POI scorés atteints (graphe van contracté fc≤5, tampon-frontière 2km, 90min EXACT), temps + valeur.
-- Sert : coverage des bases_v2, carte des trous, MCLP/p-median. Lecture reward_poi promu (v_poi). Table staging (éphémère).
-- Usage : PGOPTIONS=... psql ... -f calc/recette/76_base_poi_reachable.sql
\set ON_ERROR_STOP on

DROP TABLE IF EXISTS staging.base_poi_reachable;
CREATE TABLE staging.base_poi_reachable(base_id int, poi_id bigint, cluster_key geometry, t_s int, v_poi numeric);
DO $$
DECLARE b RECORD; rmax int := (SELECT valeur*60 FROM mcda2.routing_params WHERE profil='van' AND param='reach_seuil_min');
BEGIN
  FOR b IN SELECT base_id, node_contracte FROM staging.base_contracte_node ORDER BY base_id LOOP
    INSERT INTO staging.base_poi_reachable
    SELECT b.base_id, pt.poi_id, pt.cluster_key, min(d.agg_cost)::int, rp.v_poi
    FROM pgr_drivingDistance('SELECT id, source, target, cost_s AS cost, reverse_cost_s AS reverse_cost FROM staging.ways_van_contracte',
           b.node_contracte, rmax, directed:=true) d
    JOIN staging.poi_contracte_tampon pt ON pt.node_van = d.node
    JOIN mcda2.reward_poi rp ON rp.poi_id = pt.poi_id
    GROUP BY pt.poi_id, pt.cluster_key, rp.v_poi;
  END LOOP;
END $$;
CREATE INDEX ON staging.base_poi_reachable(base_id);
CREATE INDEX ON staging.base_poi_reachable(poi_id);

\echo '== matrice base→POI : lignes, paires distinctes, POI couverts par >=1 base =='
SELECT count(*) lignes, count(DISTINCT base_id) bases, count(DISTINCT poi_id) poi_couverts_au_moins_1_base FROM staging.base_poi_reachable;

\echo '== COUVERTURE bases_v2 : POI scorés couverts vs trous (par valeur) =='
WITH couv AS (SELECT DISTINCT poi_id FROM staging.base_poi_reachable)
SELECT
  (SELECT count(*) FROM mcda2.reward_poi) poi_total,
  (SELECT count(*) FROM couv) couverts,
  (SELECT count(*) FROM mcda2.reward_poi rp WHERE rp.poi_id NOT IN (SELECT poi_id FROM couv)) trous,
  round((SELECT sum(v_poi) FROM mcda2.reward_poi rp WHERE rp.poi_id IN (SELECT poi_id FROM couv))::numeric,1) valeur_couverte,
  round((SELECT sum(v_poi) FROM mcda2.reward_poi)::numeric,1) valeur_totale,
  round(100.0*(SELECT sum(v_poi) FROM mcda2.reward_poi rp WHERE rp.poi_id IN (SELECT poi_id FROM couv))/(SELECT sum(v_poi) FROM mcda2.reward_poi),1) pct_valeur_couverte;

\echo '== TROUS haute-valeur (POI scorés couverts par 0 base), top 15 par v_poi =='
SELECT rp.poi_id, p.nom, coalesce(p.region_libelle,p.region_id,'') region, round(rp.v_poi::numeric,3) v_poi, rp.tier
FROM mcda2.reward_poi rp JOIN poi.poi p USING(poi_id)
WHERE rp.poi_id NOT IN (SELECT DISTINCT poi_id FROM staging.base_poi_reachable)
ORDER BY rp.v_poi DESC LIMIT 15;
