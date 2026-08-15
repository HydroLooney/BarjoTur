-- lot2-bases-ideales-multimodal-v31.sql (M517) — EXPOSITION DB2 : bases idéales v3.1 + couverture sous-zones + multimodal base-base.
-- POUR B : à appliquer sur DB2 à ton feu (crible M). OWNER-SAFE : additif, crée/refresh des tables de DIFFUSION uniquement,
--   AUCUN précieux (votes/membres) touché, idempotent (DROP+CREATE). Pré-requis : B a re-sync les 3 tables staging.diff_*_v31 (DB1→DB2).
-- Nommage canonique (pas de vue _ éparse). Chemin TRACÉ (db/exposition/, pas db/sync/ gitignoré). Source DB1 = staging (A161/A162/A165).
\set ON_ERROR_STOP on
BEGIN;
-- 1) Bases idéales v3.1 : fond vivier 165 (≥1/sous-zone, emprise 4 régions) + flags focus/optimum + rayonnement + geom
DROP TABLE IF EXISTS diffusion.bases_ideales_v31 CASCADE;
CREATE TABLE diffusion.bases_ideales_v31 AS SELECT * FROM staging.diff_bases_ideales_v31;
CREATE INDEX ON diffusion.bases_ideales_v31 USING gist(geom);
CREATE INDEX ON diffusion.bases_ideales_v31 (est_recommande);
COMMENT ON TABLE diffusion.bases_ideales_v31 IS
  'v3.1 (M501/Guillaume) sur ways_ruteplan, EMPRISE 4 régions. FOND = vivier 165 (≥1/sous-zone). est_recommande=focus 30 (illuminé, ~100% valeur) ; '
  'est_optimum=18 (coude, Coulisses). rayonnement = Σ v_poi in-emprise atteignable <=90min. Résidu R1 : 53 hors-réseau (Svalbard exclus) + 151 remote.';

-- 2) Couverture des 147 sous-zones (interne 114 + voisine 33 = ≥1/sous-zone garanti)
DROP TABLE IF EXISTS diffusion.souszone_couverture_v31 CASCADE;
CREATE TABLE diffusion.souszone_couverture_v31 AS SELECT * FROM staging.diff_souszone_couverture_v31;
CREATE INDEX ON diffusion.souszone_couverture_v31 (sous_zone_id);
COMMENT ON TABLE diffusion.souszone_couverture_v31 IS
  'v3.1 : 147/147 sous-zones couvertes. type_couverture=interne (114, base dans la sous-zone) | voisine (33, base la plus proche ; îles=ferry passager). distance_km.';

-- 3) Multimodal base-à-base (temps + €) des 165, sur ways_ruteplan (699 vrais ferries)
DROP TABLE IF EXISTS diffusion.base_base_multimodal_v31 CASCADE;
CREATE TABLE diffusion.base_base_multimodal_v31 AS SELECT * FROM staging.diff_base_base_multimodal_v31;
CREATE INDEX ON diffusion.base_base_multimodal_v31 (src_base, tgt_base);
COMMENT ON TABLE diffusion.base_base_multimodal_v31 IS
  'v3.1 (M467/M517) : routage base-à-base des 165 sur ways_ruteplan. Couple TEMPS+€ : conduite_s/ferry_s (temps route/ferry séparés), '
  'length_m, n_ferries/has_ferry, peage_eur (péages), ferry_eur (tarif ferry). Carburant ∝ length_m au runtime. Base du multimodal composeur v3.1.';
COMMIT;

-- VÉRIF POST-APPLY (owner-safe, comptes attendus)
\echo '== VÉRIF : comptes attendus 165 / 147 / 27060 =='
SELECT 'bases_ideales_v31' t, count(*) n, count(*) FILTER (WHERE est_recommande) rec30, count(*) FILTER (WHERE est_optimum) opt18 FROM diffusion.bases_ideales_v31
UNION ALL SELECT 'souszone_couverture_v31', count(*), count(*) FILTER (WHERE type_couverture='interne'), count(*) FILTER (WHERE type_couverture='voisine') FROM diffusion.souszone_couverture_v31
UNION ALL SELECT 'base_base_multimodal_v31', count(*), count(*) FILTER (WHERE has_ferry), NULL FROM diffusion.base_base_multimodal_v31;
