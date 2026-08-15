-- 73_base_reward_tampon_frontiere.sql, base_reward fc≤5 avec reachability « tampon dernier-km à la frontière » (A070).
-- Corrige la faiblesse intra-ville : un POI n'est plus rattaché à SON unique noeud le plus proche (échoue si cul-de-sac
-- local dirigé), mais est atteignable si N'IMPORTE QUEL noeud contracté dans son tampon 2 km est atteint (« se garer sur
-- l'artère atteinte, marcher le dernier km »). Prouvé sur base 1 : POI 223/225 (quartiers urbains) → atteignables, 80→100%.
-- Graphe, seuil 90 min EXACT, V_poi (reward_poi_v3 figé M119), cluster-dédup : inchangés. Écrit mcda2.base_reward_v5 (NON promu).
-- Usage : PGOPTIONS="-c client_min_messages=warning -c extra_float_digits=3" psql -h localhost -p 5433 -d norvege_routing -v ON_ERROR_STOP=1 -f calc/recette/73_base_reward_tampon_frontiere.sql
\set ON_ERROR_STOP on

-- 1. BRIDGE POI scoré → tous les noeuds contractés dans le tampon 2 km (clé de la reachability tampon-frontière).
DROP TABLE IF EXISTS staging.poi_contracte_tampon;
CREATE TABLE staging.poi_contracte_tampon AS
WITH scored AS (
  SELECT p.poi_id, ST_Transform(p.geom,25833) g, ST_SnapToGrid(ST_Transform(p.geom,25833),50) cluster_key, rp.v_poi
  FROM poi.poi p JOIN mcda2.reward_poi_v3 rp ON rp.poi_id = p.poi_id
  WHERE p.geom IS NOT NULL
)
SELECT s.poi_id, cn.node AS node_van, s.cluster_key, s.v_poi
FROM scored s JOIN staging.van_contracte_node cn
  ON ST_DWithin(cn.geom, s.g, (SELECT valeur FROM mcda2.routing_params WHERE profil='van' AND param='tampon_contracte_m'));
CREATE INDEX ON staging.poi_contracte_tampon(node_van);
CREATE INDEX ON staging.poi_contracte_tampon(poi_id);
\echo '== bridge tampon-frontière : lignes / POI couverts (attendu 778) =='
SELECT count(*) lignes, count(DISTINCT poi_id) poi_couverts FROM staging.poi_contracte_tampon;

-- 2. base_reward_v5 : Σ V_poi atteignables (POI atteint si un de ses noeuds tampon est dans le reach set 90 min), cluster-dédup.
DROP TABLE IF EXISTS mcda2.base_reward_v5;
CREATE TABLE mcda2.base_reward_v5(base_id int, reward_atteignable numeric, n_clusters int, v_max numeric);
DO $$
DECLARE b RECORD; rmax int := (SELECT valeur*60 FROM mcda2.routing_params WHERE profil='van' AND param='reach_seuil_min');
BEGIN
  FOR b IN SELECT base_id, node_contracte FROM staging.base_contracte_node ORDER BY base_id LOOP
    INSERT INTO mcda2.base_reward_v5
    WITH reached AS (
      SELECT DISTINCT pt.cluster_key, pt.v_poi
      FROM pgr_drivingDistance('SELECT id, source, target, cost_s AS cost, reverse_cost_s AS reverse_cost FROM staging.ways_van_contracte',
             b.node_contracte, rmax, directed:=true) d
      JOIN staging.poi_contracte_tampon pt ON pt.node_van = d.node
    ), dedup AS (SELECT cluster_key, max(v_poi) v_c FROM reached GROUP BY cluster_key)
    SELECT b.base_id, round(coalesce(sum(v_c),0)::numeric,3), count(*)::int, round(coalesce(max(v_c),0)::numeric,3) FROM dedup;
  END LOOP;
END $$;
CREATE INDEX ON mcda2.base_reward_v5(base_id);
COMMENT ON TABLE mcda2.base_reward_v5 IS 'base_reward fc≤5 + reachability tampon dernier-km à la frontière (A070). POI atteint si noeud tampon 2km dans reach 90min. Q hérité v2. v1 15/08.';

\echo '== base_reward_v5 : distribution + dédup =='
SELECT count(*) bases, round(avg(reward_atteignable)::numeric,1) moy, round(min(reward_atteignable)::numeric,1) mn, round(max(reward_atteignable)::numeric,1) mx, round(avg(n_clusters)::numeric,0) clusters_moy, count(*) FILTER (WHERE reward_atteignable=0) zero_reward FROM mcda2.base_reward_v5;
\echo '== écart v5 vs v4 (impact tampon-frontière) + v5 vs v2 =='
SELECT round(corr(v5.reward_atteignable, v4.reward_atteignable)::numeric,3) corr_v5_v4 FROM mcda2.base_reward_v5 v5 JOIN mcda2.base_reward_v4 v4 USING(base_id);
SELECT round(corr(v5.reward_atteignable, v2.reward_atteignable)::numeric,3) corr_v5_v2 FROM mcda2.base_reward_v5 v5 JOIN mcda2.base_reward v2 USING(base_id);
\echo '== empreinte base_reward_v5 =='
SELECT md5(string_agg(md5(t.*::text), '' ORDER BY base_id)) FROM (SELECT base_id, reward_atteignable, n_clusters FROM mcda2.base_reward_v5) t;
