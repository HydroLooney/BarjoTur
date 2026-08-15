-- 84_recompute_deps.sql (M459 scaffold #3) — REGISTRE MACHINE du pipeline recompute incrémental v3.
-- Contrepartie exécutable du DAG narratif (docs/design/DEPENDANCES-RECOMPUTE-v3.md + RECOMPUTE-INCREMENTAL-v3.md).
-- But : savoir, quand une SOURCE bouge, quelles CIBLES rejouer, par quelle MÉTHODE, à quel COÛT, et OÙ (canonique DB1 / live DB2 / async).
-- Doctrine M268 : tout dérivé se recalcule from-scratch ; jamais de valeur v2 ; invalidation ciblée, jamais full à l'aveugle.
-- Idempotent. Usage : psql -h localhost -p 5433 -d norvege_routing -v ON_ERROR_STOP=1 -f calc/recette/passe2/84_recompute_deps.sql
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA IF NOT EXISTS meta;

CREATE TABLE IF NOT EXISTS meta.recompute_deps (
  cible      text PRIMARY KEY,          -- objet dérivé (table/vue/fichier)
  sources    text[] NOT NULL,           -- amont direct (invalide la cible s'il bouge)
  methode    text NOT NULL,             -- script/fonction reproductible
  cout       text NOT NULL CHECK (cout IN ('leger','moyen','lourd')),
  placement  text NOT NULL CHECK (placement IN ('canonique_db1','live_db2','async','doc')),
  statut     text NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif','held','a_faire')),
  note       text
);

INSERT INTO meta.recompute_deps (cible, sources, methode, cout, placement, statut, note) VALUES
 -- Couche POI (v3, en place)
 ('poi.poi(confiance,statut_perle,tres_frequente)', ARRAY['poi/','staging.poi_v3'], '90_enrichissement_poi.sql', 'moyen','canonique_db1','actif','+ garde-fou géo 0-perte + dedup'),
 ('mcda2.reward_poi',      ARRAY['poi.poi','mcda2.qualite_poi','mcda2.defaut_poi'], '91_rescore_tier_v3.sql + reward_poi.v_poi', 'moyen','canonique_db1','actif','tier T-C + v_poi=facteur_avis(tier)*(1+0.5*q_std)'),
 ('diffusion.v_web_poi',   ARRAY['mcda2.reward_poi'], '87_diffusion_views_v3.sql', 'leger','live_db2','actif','contrat web POI-level'),
 -- Facility-loc (v3, en place)
 ('staging.amenite_van_ok',ARRAY['mcda2.ways_van','amenites.amenite'], 'pgr_connectedComponents + snap<=500m', 'lourd','canonique_db1','actif','giant 786432 ; 1039 van_ok'),
 ('staging.floc_reach',    ARRAY['staging.floc_candidat','mcda2.ways_van'], 'floc_reach_one.sql (boucle externe)', 'lourd','canonique_db1','actif','matrice reachability <=90min ; empreinte 8088e472'),
 ('mcda2.bases_ideales',   ARRAY['staging.floc_reach','staging.floc_greedy'], 'floc_greedy.sql + 78_bases_ideales_table.sql', 'moyen','canonique_db1','actif','facility-loc N=18 (v3.0) ; vivier 165 (v3.1)'),
 ('mcda2.base_reward',     ARRAY['mcda2.bases_ideales','staging.floc_reach'], '70_base_reward.sql', 'moyen','canonique_db1','actif','Sigma v_poi atteignable'),
 ('mcda2.base_rayonnement',ARRAY['mcda2.bases_ideales','staging.floc_reach'], '75_base_rayonnement.sql', 'moyen','canonique_db1','actif',NULL),
 -- Empreintes (cleanup #2, en place)
 ('db/sync/empreintes-reference.tsv', ARRAY['mcda2.reward_poi','mcda2.base_reward','mcda2.bases_ideales'], '83_empreintes_reference.sql', 'leger','doc','actif','recette canonique reproductible, fin du manquement repro'),
 -- Composeur v3.1 (chantier en cours, M459)
 ('staging.bb_route',      ARRAY['staging.vivier','mcda2.ways_van'], '82_base_base_one.sql (boucle externe checkpoint)', 'lourd','canonique_db1','actif','routage 165 : conduite_s/length_m/has_ferry (from-scratch v3)'),
 ('staging.bb_path',       ARRAY['staging.vivier','mcda2.ways_van'], '82_base_base_one.sql', 'lourd','canonique_db1','actif','APSP path/n_legs vivier 165'),
 ('mcda2.base_reward_inputs(f1-6,reward_top8,hors_foule)', ARRAY['mcda2.reward_inputs','staging.floc_reach'], 'spec formule v3 (R19, M) — HELD', 'moyen','canonique_db1','held','arbitrages #2 orness / #6 V_poi cadrés avec Guillaume'),
 ('mcda2.base_base_cost_temps(pauses_s,pleins_s,temps_reel_s)', ARRAY['staging.bb_route'], 'modele conduite v3 (R19, M) — HELD', 'leger','canonique_db1','held','arbitrage #4 : regle pauses/pleins v3 explicite'),
 ('mcda2.base_activite_supply/candidate', ARRAY['staging.floc_reach','poi.poi'], 'spec seuils v3 (R19, M) — partiel HELD', 'moyen','canonique_db1','held','#5 seuils jours_worth/nuits_max_faisable (M190)')
ON CONFLICT (cible) DO UPDATE SET sources=EXCLUDED.sources, methode=EXCLUDED.methode, cout=EXCLUDED.cout, placement=EXCLUDED.placement, statut=EXCLUDED.statut, note=EXCLUDED.note;

COMMENT ON TABLE meta.recompute_deps IS
  'M459 : registre machine du recompute incrémental v3 (source->cible + methode + cout + placement + statut). '
  'Contrepartie de docs/design/DEPENDANCES-RECOMPUTE-v3.md. Une source qui bouge invalide ses cibles (statut actif). 84_recompute_deps.sql.';
COMMIT;

\echo '== recompute_deps : par coût et statut =='
SELECT cout, statut, count(*) FROM meta.recompute_deps GROUP BY 1,2 ORDER BY 1,2;
\echo '== HELD (attendent spec formule R19 de M) =='
SELECT cible, note FROM meta.recompute_deps WHERE statut='held' ORDER BY cible;
