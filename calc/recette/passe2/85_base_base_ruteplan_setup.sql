-- 85_base_base_ruteplan_setup.sql (M467 (a)+(c)) — ROUTAGE base-à-base du vivier 165 sur le GRAPHE CANONIQUE v3 staging.ways_ruteplan.
-- Corrige A155/A156 : ways_van (6 ferries synthétiques) = scorie v2. ways_ruteplan = Ruteplan natif, 699 ferries RÉELS (temps NVDB)
--   + tunnels + PÉAGES (peage_eur) + TARIFS FERRY (ferry_eur) → base du modèle MULTIMODAL temps+argent (Guillaume, M467c).
-- Méthode canonique 32_matrice_ruteplan.sql : dijkstra one-to-many par base (snap staging.base_ruteplan_node, 165), route/ferry SÉPARÉS.
-- Enregistre le couple (temps, €) par paire : conduite_s/ferry_s + peage_eur/ferry_eur + km + n_ferries. Le FRONT de compromis (routes
--   alternatives ferry-vs-route) = spec formule v3.1 de M (#4 conduite). Ici : route plus-court-temps + coûts € portés.
-- Discipline M403 : staging, boucle externe (85_..._one.sql, 1 source/appel = commit checkpoint), reprise via bbr_progress, no DO monolithique.
-- Idempotent (setup). Usage : psql -h localhost -p 5433 -d norvege_routing -v ON_ERROR_STOP=1 -f calc/recette/passe2/85_base_base_ruteplan_setup.sql
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS staging.bbr_route (
  src_base    integer NOT NULL,
  tgt_base    integer NOT NULL,
  conduite_s  double precision,   -- Σ cost arêtes ROUTE (temps de conduite réel)
  ferry_s     double precision,   -- Σ cost arêtes FERRY (temps NVDB réel de traversée + attente incluse dans NVDB)
  length_m    double precision,   -- Σ length_m (route + ferry)
  n_ferries   integer,            -- nb d'arêtes ferry sur le chemin
  has_ferry   boolean,
  peage_eur   numeric,            -- Σ peage_eur (tunnels/autoroutes à péage) — MULTIMODAL argent
  ferry_eur   numeric,            -- Σ ferry_eur (tarif des bacs) — MULTIMODAL argent
  PRIMARY KEY (src_base, tgt_base)
);
CREATE TABLE IF NOT EXISTS staging.bbr_path (
  src_base integer NOT NULL, tgt_base integer NOT NULL, path bigint[], n_legs integer,
  PRIMARY KEY (src_base, tgt_base)
);
CREATE TABLE IF NOT EXISTS staging.bbr_progress (
  src_base integer PRIMARY KEY, n_tgt integer, done_at timestamptz DEFAULT now()
);
COMMENT ON TABLE staging.bbr_route IS
  'v3.1 M467 : routage base-à-base vivier 165 sur ways_ruteplan (graphe CANONIQUE v3, vrais ferries+tunnels+péages). '
  'Route/ferry temps SÉPARÉS + coûts € (peage_eur/ferry_eur) = base multimodal temps+argent. 85_base_base_ruteplan_setup.sql. '
  'Remplace staging.bb_route (route-seule ways_van, scorie). Front de compromis = spec v3.1 M.';
COMMIT;
\echo '== setup ruteplan : prêt (base_ruteplan_node / bbr_route) =='
SELECT (SELECT count(*) FROM staging.base_ruteplan_node) bases_snappees,
       (SELECT count(*) FROM staging.bbr_route) route_rows,
       (SELECT count(*) FROM staging.bbr_progress) progress;
