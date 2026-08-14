-- 50_krigeage_rayonnement.sql (tâche A-08 étape 3 : champ de qualité RÉSEAU → rayonnement par base).
-- « Qualité atteignable par base, sans supposer d'itinéraire » (doc 10/16), ANTI-MAUP : accessibilité réseau
-- avec décroissance (noyau = krigeage simple à covariance exponentielle / lissage de noyau sur le réseau), PAS
-- une moyenne zonale. Chaque base « rayonne » : elle capte la qualité des POI qu'elle atteint, pondérée par le
-- temps-réseau. C'est le signal dont A-11 (bases idéales par couverture) a besoin.
--
-- MÉTHODE : depuis le noeud van de chaque base, pgr_drivingDistance (graphe van moins exclusions) borné à R,
--   rayonnement = Σ_i Q_i · exp(−coût_i / λ)   sur les POI van-accessibles atteints.
--   R = 45 min (cap), λ = 25 min (portée e-folding : un POI à 25 min pèse 1/e). Coût = temps van (cost_s/60).
--
-- POI van-accessibles = qualite_poi snappés au noeud giant le plus proche (mcda2._q_poi_van_node), gardés à
--   d_m ≤ 3 km. Vérifié (14/08) : médiane de snap 112 m ; ~200 POI à 20-1578 km sont hors réseau van
--   (imports wemap de Suède/Finlande/est lointain, lon 16-31) → exclus honnêtement (non atteignables en van).
--
-- ways_van read-only (exclusions appliquées, comme la matrice). Idempotent. LENT (~18 min, 105 bases × ~10 s).
-- Usage : psql -h localhost -p 5433 -d norvege_routing -v ON_ERROR_STOP=1 -f calc/recette/50_krigeage_rayonnement.sql

\set ON_ERROR_STOP on
\set R 45
\set lambda 25
\set seuil_acces_m 3000

-- Le snap _q_poi_van_node est produit en amont (idempotent) : Q-POI → noeud giant le plus proche.
DROP TABLE IF EXISTS mcda2._q_poi_van_node;
CREATE TABLE mcda2._q_poi_van_node AS
SELECT q.poi_id, q.qualite, nn.node AS node_van, nn.d_m
FROM mcda2.qualite_poi q
JOIN poi.poi p ON p.poi_id=q.poi_id AND p.merged_into_poi_id IS NULL
CROSS JOIN LATERAL (
  SELECT g.node, ST_Distance(p.geom::geography, g.geom::geography) AS d_m
  FROM mcda2._van_nodes_giant g ORDER BY p.geom <-> g.geom LIMIT 1
) nn;
ALTER TABLE mcda2._q_poi_van_node ADD PRIMARY KEY (poi_id);
CREATE INDEX ON mcda2._q_poi_van_node(node_van);
COMMENT ON TABLE mcda2._q_poi_van_node IS 'Snap Q-POI → noeud van giant (50_krigeage_rayonnement.sql). d_m>3km = hors réseau van (Suède/remote), exclu du rayonnement.';

DROP TABLE IF EXISTS mcda2.base_rayonnement;
CREATE TABLE mcda2.base_rayonnement (
  base_id       bigint PRIMARY KEY,
  rayonnement   double precision,   -- Σ Q·exp(−coût/λ) : qualité atteignable pondérée temps (le score de base)
  n_poi         integer,            -- nb de POI van-accessibles atteints ≤ R
  q_max         double precision,   -- meilleure qualité atteignable
  q_moy_pond    double precision,   -- qualité moyenne pondérée par la décroissance
  params        text DEFAULT 'R=45min, lambda=25min, acces<=3km, graphe van moins exclusions'
);

INSERT INTO mcda2.base_rayonnement (base_id, rayonnement, n_poi, q_max, q_moy_pond)
SELECT b.base_id,
       COALESCE(r.rayonnement,0), COALESCE(r.n_poi,0), r.q_max, r.q_moy_pond
FROM mcda2.base_node_van b
CROSS JOIN LATERAL (
  SELECT sum(qp.qualite*exp(-dd.agg_cost/ :lambda )) AS rayonnement,
         count(*) AS n_poi,
         max(qp.qualite) AS q_max,
         sum(qp.qualite*exp(-dd.agg_cost/ :lambda )) / nullif(sum(exp(-dd.agg_cost/ :lambda )),0) AS q_moy_pond
  FROM pgr_drivingDistance(
    'SELECT id, source, target, cost_s/60.0 AS cost, reverse_cost_s/60.0 AS reverse_cost FROM mcda2.ways_van WHERE id NOT IN (SELECT edge_id FROM mcda2.ways_van_exclusions)',
    b.node_van, :R, false) dd
  JOIN mcda2._q_poi_van_node qp ON qp.node_van=dd.node AND qp.d_m <= :seuil_acces_m
) r;

COMMENT ON TABLE mcda2.base_rayonnement IS
  'A-08 étape 3 : qualité RÉSEAU atteignable par base (anti-MAUP). rayonnement = Σ Q·exp(−coût_van/λ), '
  'R=45min λ=25min, POI van-accessibles ≤3km. 50_krigeage_rayonnement.sql. Alimente A-11 (bases idéales) et base_reward_inputs.';

-- Vérifications.
\echo '== base_rayonnement : couverture + bornes =='
SELECT count(*) n_bases, count(*) FILTER (WHERE n_poi=0) bases_sans_poi,
       round(min(rayonnement)::numeric,2) r_min, round(avg(rayonnement)::numeric,2) r_moy, round(max(rayonnement)::numeric,2) r_max,
       round(avg(n_poi)::numeric,1) n_poi_moy
FROM mcda2.base_rayonnement;
\echo '== top 5 / bottom 5 bases par rayonnement (bon sens) =='
(SELECT 'TOP' t, base_id, round(rayonnement::numeric,2) ray, n_poi, round(q_max::numeric,3) qmax FROM mcda2.base_rayonnement ORDER BY rayonnement DESC LIMIT 5)
UNION ALL
(SELECT 'BOT', base_id, round(rayonnement::numeric,2), n_poi, round(q_max::numeric,3) FROM mcda2.base_rayonnement ORDER BY rayonnement ASC LIMIT 5);
