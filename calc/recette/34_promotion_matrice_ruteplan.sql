-- 34_promotion_matrice_ruteplan.sql, PROMOTION staging.matrice_ruteplan → mcda2.matrice_base_base (SUR GO M seulement).
-- Backup-first, réversible (doctrine A14 : une version par calcul, remplace le dérivé). NE PAS lancer sans GO (M090/M091).
-- Garde-fou : refuse si l'empreinte staging ≠ f8a28782 (la matrice validée). Pas de vue dépendante (vérifié) → sûr.
-- Colonnes variantes (detour/ferry_obligatoire) + ferry € restent NULL ici, remplies aux étapes 35_ (variantes) / AutoPASS.
-- Usage (APRÈS GO) : PGOPTIONS="-c client_min_messages=warning -c extra_float_digits=3 -c datestyle=ISO -c timezone=UTC" psql -h localhost -p 5433 -d norvege_routing -v ON_ERROR_STOP=1 -f calc/recette/34_promotion_matrice_ruteplan.sql

\set ON_ERROR_STOP on
BEGIN;

-- 0. Garde-fou empreinte (refuse une matrice non validée).
DO $$
DECLARE emp text;
BEGIN
  SELECT md5(string_agg(md5(t.*::text), '' ORDER BY t.source_base, t.target_base)) INTO emp
  FROM (SELECT source_base,target_base,minutes_roulage,minutes_ferry,km,ferry,n_ferries FROM staging.matrice_ruteplan) t;
  IF emp <> 'f8a28782afbd6d58e748310be20b6a94' THEN
    RAISE EXCEPTION 'Empreinte staging % != f8a28782 attendue — promotion refusée (R1)', emp;
  END IF;
  RAISE NOTICE 'Empreinte staging vérifiée : %', emp;
END $$;

-- 1. Backup live (réversible).
DROP TABLE IF EXISTS staging.matrice_base_base_backup_pre_ruteplan;
CREATE TABLE staging.matrice_base_base_backup_pre_ruteplan AS SELECT * FROM mcda2.matrice_base_base;

-- 2. Colonne n_ferries (segments) additive si absente.
ALTER TABLE mcda2.matrice_base_base ADD COLUMN IF NOT EXISTS n_ferries int;

-- 3. Remplacement du contenu (source dérivée Ruteplan). Colonnes variantes/ferry€ = NULL (étapes suivantes).
TRUNCATE mcda2.matrice_base_base;
INSERT INTO mcda2.matrice_base_base
 (source_base, target_base, minutes_roulage, minutes_ferry, km, ferry, n_ferries,
  prix_van_eur, roulage_detour_min, km_detour, detour_possible,
  cout_carburant_eur, cout_ferry_eur, cout_peage_eur, cout_eur_total, ferry_obligatoire)
SELECT source_base, target_base, minutes_roulage, minutes_ferry, km, ferry, n_ferries,
  NULL, NULL, NULL, NULL,
  cout_carburant_eur, cout_ferry_eur, cout_peage_eur, cout_eur_total, NULL
FROM staging.matrice_ruteplan;

COMMENT ON TABLE mcda2.matrice_base_base IS
 'Matrice base-à-base, graphe Ruteplan natif (topologie officielle + temps ferry NVDB). Recompute from-raw 14/08. '
 'Empreinte f8a28782afbd6d58e748310be20b6a94 (temps/km/ferry). € : carburant+péage réels, ferry€ NULL (AutoPASS à venir). '
 'Backup pré-promotion : staging.matrice_base_base_backup_pre_ruteplan. Scripts 31_/32_/33_/34_.';

-- 4. Re-gate sur le live.
\echo '== volumétrie / NULL =='
SELECT count(*) paires, count(*) FILTER (WHERE minutes_roulage IS NULL OR minutes_ferry IS NULL) nulls FROM mcda2.matrice_base_base;
\echo '== ouest 12/12 =='
SELECT count(DISTINCT target_base) FROM mcda2.matrice_base_base m JOIN mcda2.bases_v2 b ON b.base_id=m.target_base WHERE b.lon<6;
\echo '== empreinte live (doit = f8a28782) =='
SELECT md5(string_agg(md5(t.*::text), '' ORDER BY t.source_base, t.target_base)) empreinte
FROM (SELECT source_base,target_base,minutes_roulage,minutes_ferry,km,ferry,n_ferries FROM mcda2.matrice_base_base) t;

COMMIT;
\echo '== PROMU. Rollback possible : TRUNCATE + INSERT depuis staging.matrice_base_base_backup_pre_ruteplan =='
