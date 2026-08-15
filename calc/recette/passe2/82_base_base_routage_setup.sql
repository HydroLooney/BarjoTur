-- 82_base_base_routage_setup.sql (chantier composeur v3.1, M459 GO — ROUTAGE base-à-base des 165, from-scratch v3).
-- Reconstruit base_base_cost_temps (conduite_s/length_m/has_ferry) + base_base_path (path/n_legs) pour le VIVIER 165,
-- via pgr_dijkstra one-to-many sur mcda2.ways_van (coût réel cost_s, longueur length_m, ferry est_ferry).
-- COLONNES-MODÈLE (pauses_s/pleins_s/temps_reel_s) = HELD (arbitrage #4 M450, règle v3 de conduite cadrée avec Guillaume) → NULL+flag.
-- Discipline M403/M459 : tables STAGING, boucle externe (82_base_base_one.sql, 1 source/appel psql = commit autocommit checkpoint),
-- reprise via staging.bb_progress, jamais de DO monolithique, jamais de requête lourde concurrente. Reproduire les 105 d'abord → écart → 165.
-- Idempotent (setup). Usage : psql -h localhost -p 5433 -d norvege_routing -v ON_ERROR_STOP=1 -f calc/recette/passe2/82_base_base_routage_setup.sql
\set ON_ERROR_STOP on
BEGIN;

-- Résultats routage (staging, ré-générés en prod par le Maître après crible)
CREATE TABLE IF NOT EXISTS staging.bb_route (
  src_base   integer NOT NULL,
  tgt_base   integer NOT NULL,
  conduite_s double precision,   -- pgr agg_cost (cost_s), = temps de conduite réel
  length_m   double precision,   -- Σ length_m des arêtes du plus court chemin
  has_ferry  boolean,            -- bool_or(est_ferry) sur le chemin
  PRIMARY KEY (src_base, tgt_base)
);
CREATE TABLE IF NOT EXISTS staging.bb_path (
  src_base integer NOT NULL,
  tgt_base integer NOT NULL,
  path     bigint[],             -- séquence d'arêtes (ways_van.id) du plus court chemin
  n_legs   integer,
  PRIMARY KEY (src_base, tgt_base)
);
CREATE TABLE IF NOT EXISTS staging.bb_progress (
  src_base integer PRIMARY KEY,
  n_tgt    integer,
  done_at  timestamptz DEFAULT now()
);

COMMENT ON TABLE staging.bb_route IS
  'v3.1 M459 : routage base-à-base du vivier 165 (pgr_dijkstra one-to-many sur ways_van, cost_s). conduite_s/length_m/has_ferry '
  'from-scratch v3. pauses_s/pleins_s/temps_reel_s NON inclus (colonnes-modèle HELD, arbitrage #4). 82_base_base_routage_setup.sql.';

COMMIT;

\echo '== setup routage base-base : tables staging prêtes =='
SELECT 'vivier' t, count(*) n, count(*) FILTER (WHERE source='base_v2') base_v2, count(*) FILTER (WHERE source='ajout_v31') ajouts FROM staging.vivier
UNION ALL SELECT 'bb_route', count(*), NULL, NULL FROM staging.bb_route
UNION ALL SELECT 'bb_progress', count(*), NULL, NULL FROM staging.bb_progress;
