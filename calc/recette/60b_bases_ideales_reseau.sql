-- 60b_bases_ideales_reseau.sql (tâche A-11, raffinement RÉSEAU du greedy euclidien 60_bases_ideales.sql).
-- Re-score les 60 bases idéales avec le rayonnement RÉSEAU anti-MAUP (comme mcda2.base_rayonnement), pour
-- corriger le proxy euclidien (fjords/routes). Ajoute rayonnement_reseau + n_poi_reseau à bases_ideales.
--
-- Snap de chaque base idéale au noeud giant le plus proche, puis pgr_drivingDistance cap 45 min, décroissance
-- λ=25 min sur les Q-POI van-accessibles (_q_poi_van_node). ways_van read-only (exclusions). Idempotent. ~10 min.
-- Usage : psql -h localhost -p 5433 -d norvege_routing -v ON_ERROR_STOP=1 -f calc/recette/60b_bases_ideales_reseau.sql

\set ON_ERROR_STOP on

-- Snap des 60 bases idéales au noeud giant.
ALTER TABLE mcda2.bases_ideales ADD COLUMN IF NOT EXISTS node_van bigint;
ALTER TABLE mcda2.bases_ideales ADD COLUMN IF NOT EXISTS rayonnement_reseau double precision;
ALTER TABLE mcda2.bases_ideales ADD COLUMN IF NOT EXISTS n_poi_reseau integer;

BEGIN;
-- Snap (temp keyé par point_id, puis UPDATE : évite la référence FROM-clause à la cible en LATERAL).
CREATE TEMP TABLE _snap ON COMMIT DROP AS
SELECT bi.point_id, (SELECT g.node FROM mcda2._van_nodes_giant g ORDER BY bi.geom <-> g.geom LIMIT 1) AS node
FROM mcda2.bases_ideales bi;
UPDATE mcda2.bases_ideales bi SET node_van = s.node FROM _snap s WHERE s.point_id = bi.point_id;

-- Rayonnement réseau par base idéale (LATERAL dans un SELECT : bi.node_van référençable).
CREATE TEMP TABLE _ray ON COMMIT DROP AS
SELECT bi.point_id, r.ray, r.n_poi
FROM mcda2.bases_ideales bi
CROSS JOIN LATERAL (
  SELECT sum(qp.qualite*exp(-dd.agg_cost/25.0)) AS ray, count(*) AS n_poi
  FROM pgr_drivingDistance(
    'SELECT id, source, target, cost_s/60.0 AS cost, reverse_cost_s/60.0 AS reverse_cost FROM mcda2.ways_van WHERE id NOT IN (SELECT edge_id FROM mcda2.ways_van_exclusions)',
    bi.node_van, 45.0, false) dd
  JOIN mcda2._q_poi_van_node qp ON qp.node_van=dd.node AND qp.d_m<=3000
) r;
UPDATE mcda2.bases_ideales bi SET rayonnement_reseau = _ray.ray, n_poi_reseau = _ray.n_poi
FROM _ray WHERE _ray.point_id = bi.point_id;
COMMIT;

UPDATE mcda2.bases_ideales SET rayonnement_reseau=COALESCE(rayonnement_reseau,0), n_poi_reseau=COALESCE(n_poi_reseau,0);

-- Vérifications : corrélation euclidien vs réseau, re-classement.
\echo '== euclidien (gain/couv) vs réseau : les 2 mesures s accordent-elles ? (top par réseau) =='
SELECT rang AS rang_euclid, point_id, round(couv_totale::numeric,2) couv_euclid,
       round(rayonnement_reseau::numeric,2) ray_reseau, n_poi_reseau, left(coalesce(name,''),26) nom
FROM mcda2.bases_ideales ORDER BY rayonnement_reseau DESC NULLS LAST LIMIT 10;
\echo '== bases idéales à faible rayonnement réseau (proxy euclidien trompeur : POI de l autre côté d un fjord) =='
SELECT count(*) FILTER (WHERE rayonnement_reseau<0.5) AS faibles_reseau,
       round(corr(couv_totale, rayonnement_reseau)::numeric,3) AS correl_euclid_reseau
FROM mcda2.bases_ideales;
