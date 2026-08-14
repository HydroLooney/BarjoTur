-- 31_rebuild_matrice_vsuivante.sql (tâche A-06, prépare la matrice v-suivante SANS clobber).
-- Rejoue l'A* base-à-base AVEC le recoûtage ferry (A-19, `ways_van_cout_override`) injecté par COALESCE, et
-- les exclusions à jour (44 artefacts >35km purgés). Écrit dans STAGING seulement.
--
-- ⚠ NON-CLOBBER (consigne M020/M021) : ne TRUNCATE PAS `mcda2.matrice_base_base` (empreinte gate-validée
-- a40a9922 que B a chargée). Produit `staging.matrice_astar_vsuivante` + preuves + DELTA vs la matrice live,
-- pour que M puisse arbitrer et SÉQUENCER le swap (30_matrices adapté + dump → B, nouvelle convergence DB2).
-- Tant que M n'a pas séquencé, la matrice live reste intacte. Rejouable, réversible.
--
-- ways_van read-only : le recoûtage vit dans l'override, appliqué par COALESCE au moment du routage. Idempotent.
-- Usage : psql -h localhost -p 5433 -d norvege_routing -v ON_ERROR_STOP=1 -f calc/recette/31_rebuild_matrice_vsuivante.sql

\set ON_ERROR_STOP on

-- 1. A* v-suivante (override recoût + exclusions à jour) dans staging.
DROP TABLE IF EXISTS staging.matrice_astar_vsuivante;
CREATE TABLE staging.matrice_astar_vsuivante AS
SELECT m.start_vid, m.end_vid, m.agg_cost AS cost_s
FROM pgr_aStarCostMatrix(
  'SELECT w.id, w.source, w.target,
          COALESCE(o.cost_s, w.cost_s)         AS cost,
          COALESCE(o.cost_s, w.reverse_cost_s) AS reverse_cost,
          w.x1, w.y1, w.x2, w.y2
   FROM mcda2.ways_van w
   LEFT JOIN mcda2.ways_van_cout_override o ON o.edge_id = w.id
   WHERE w.x1 IS NOT NULL
     AND w.id NOT IN (SELECT edge_id FROM mcda2.ways_van_exclusions)',
  ARRAY(SELECT node_van FROM mcda2.bases_v2 ORDER BY base_id),
  directed := true,
  heuristic := 2
) m;
CREATE INDEX ON staging.matrice_astar_vsuivante (start_vid, end_vid);

-- 2. Vue base-à-base (minutes) pour les preuves + delta, via node_van → base_id.
DROP TABLE IF EXISTS staging.matrice_vsuivante_bb;
CREATE TABLE staging.matrice_vsuivante_bb AS
SELECT nb_s.base_id AS source_base, nb_t.base_id AS target_base,
       ROUND((raw.cost_s/60.0)::numeric,1) AS minutes
FROM staging.matrice_astar_vsuivante raw
JOIN mcda2.bases_v2 nb_s ON nb_s.node_van = raw.start_vid
JOIN mcda2.bases_v2 nb_t ON nb_t.node_van = raw.end_vid;
CREATE INDEX ON staging.matrice_vsuivante_bb (source_base, target_base);

-- Preuves (verification-before-completion).
\echo '== v-suivante : couverture + symétrie (0 asymétrique attendu) =='
SELECT count(*) AS paires,
       count(*) FILTER (WHERE m1.minutes IS DISTINCT FROM m2.minutes) AS asymetriques
FROM staging.matrice_vsuivante_bb m1
JOIN staging.matrice_vsuivante_bb m2 ON m2.source_base=m1.target_base AND m2.target_base=m1.source_base
WHERE m1.source_base < m1.target_base;
\echo '== ouest atteint : bases lon<6 joignables depuis toutes les autres (0 inatteignable attendu) =='
SELECT count(DISTINCT b.base_id) AS bases_ouest,
       count(DISTINCT b.base_id) FILTER (WHERE NOT EXISTS (
         SELECT 1 FROM staging.matrice_vsuivante_bb m WHERE m.target_base=b.base_id AND m.minutes IS NOT NULL)) AS ouest_inatteignables
FROM mcda2.bases_v2 b WHERE b.lon < 6;
\echo '== DELTA recoûtage : paires dont le temps change vs la matrice live (impact du ferry recoûté) =='
SELECT count(*) AS paires_modifiees,
       round(avg(abs(v.minutes - l.minutes_roulage - l.minutes_ferry))::numeric,1) AS delta_moy_min,
       round(max(abs(v.minutes - l.minutes_roulage - l.minutes_ferry))::numeric,1) AS delta_max_min
FROM staging.matrice_vsuivante_bb v
JOIN mcda2.matrice_base_base l ON l.source_base=v.source_base AND l.target_base=v.target_base
WHERE abs(v.minutes - COALESCE(l.minutes_roulage,0) - COALESCE(l.minutes_ferry,0)) > 1;
\echo '== RAPPEL : matrice live INTACTE (a40a9922). staging.matrice_vsuivante_bb prête pour arbitrage M + swap séquencé. =='
