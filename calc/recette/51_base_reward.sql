-- 51_base_reward.sql (tâche A-09, « reward atteignable par base », anti-MAUP ; refonte v3 du base_reward_inputs zonal).
-- Comme 50_krigeage_rayonnement mais pondère par la VALEUR DE NŒUD V_poi (reward_poi) au lieu de la seule qualité Q :
--   reward_atteignable = Σ_i V_poi_i · exp(−coût_van_i / λ)   sur les POI van-accessibles atteints ≤ R.
-- Le composeur choisit parmi les bases idéales selon ce reward atteignable (sans supposer d'itinéraire, doc 10).
-- R=45min, λ=25min, POI van-accessibles ≤3km (mêmes params que base_rayonnement). ways_van read-only. LENT (~18min).
--
-- Table NEUVE `mcda2.base_reward` (n'écrase pas le base_reward_inputs v2 zonal ; M séquence la bascule composeur).
-- Usage : psql -h localhost -p 5433 -d norvege_routing -v ON_ERROR_STOP=1 -f calc/recette/51_base_reward.sql

\set ON_ERROR_STOP on

DROP TABLE IF EXISTS mcda2.base_reward;
CREATE TABLE mcda2.base_reward (
  base_id          bigint PRIMARY KEY,
  reward_atteignable double precision,  -- Σ V_poi·exp(−coût/λ) : le score de base pour la sélection
  n_poi            integer,
  v_max            double precision,    -- meilleure valeur de nœud atteignable
  params           text DEFAULT 'R=45min, lambda=25min, acces<=3km, V_poi=reward_poi, graphe van moins exclusions'
);

INSERT INTO mcda2.base_reward (base_id, reward_atteignable, n_poi, v_max)
SELECT b.base_id, COALESCE(r.rew,0), COALESCE(r.n_poi,0), r.v_max
FROM mcda2.base_node_van b
CROSS JOIN LATERAL (
  SELECT sum(rp.v_poi*exp(-dd.agg_cost/25.0)) AS rew, count(*) AS n_poi, max(rp.v_poi) AS v_max
  FROM pgr_drivingDistance(
    'SELECT id, source, target, cost_s/60.0 AS cost, reverse_cost_s/60.0 AS reverse_cost FROM mcda2.ways_van WHERE id NOT IN (SELECT edge_id FROM mcda2.ways_van_exclusions)',
    b.node_van, 45.0, false) dd
  JOIN mcda2._q_poi_van_node qp ON qp.node_van=dd.node AND qp.d_m<=3000
  JOIN mcda2.reward_poi rp ON rp.poi_id=qp.poi_id
) r;

COMMENT ON TABLE mcda2.base_reward IS
  'A-09 : reward atteignable par base (anti-MAUP) = Σ V_poi·exp(−coût_van/λ). Refonte v3 du base_reward_inputs zonal. 51_base_reward.sql.';

\echo '== base_reward : couverture + bornes =='
SELECT count(*) n, count(*) FILTER (WHERE n_poi=0) sans_poi,
       round(min(reward_atteignable)::numeric,2) rmin, round(avg(reward_atteignable)::numeric,2) rmoy, round(max(reward_atteignable)::numeric,2) rmax
FROM mcda2.base_reward;
\echo '== top 5 bases par reward atteignable =='
SELECT base_id, round(reward_atteignable::numeric,2) rew, n_poi, round(v_max::numeric,3) v_max
FROM mcda2.base_reward ORDER BY reward_atteignable DESC LIMIT 5;
