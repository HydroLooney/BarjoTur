-- 01_ferry_cout.sql, ajout des colonnes cout_nok / cout_eur / source / annee sur ferry_leg.
-- Retire le forfait cout_eur_estime=35 (remplacé par les vrais tarifs sourcés).
-- Décision M009/M012 (figée C02) : ferry_leg conservé, le coût = colonnes, pas la table.
--
-- Tarifs sourcés AutoPASS ferje 2026 (M009) :
--   Corridor 6<->74 (Bergen<->Stord) : 74->6 présent dans ferry_leg.
--     Ligne Jektavik-Hodnanes : 69 NOK ; ligne Våge-Halhjem : 129 NOK.
--     Total 6<->74 (aller) = 198 NOK/sens.
--     Source : fergeruter.info, autopassferje.no, grille 2026. Confiance haute.
--   Corridor 82<->77 : 77->82 dans ferry_leg est INVALIDE van (Hardangerfjordekspressen,
--     bateau passagers Rødne). cout_nok = NULL, source = 'invalide_bateau_passagers_M009'.
--     Ce tronçon ne doit pas être utilisé dans la matrice ; cf. trou volontaire 30_matrices.
--   Les 76 autres lignes : tarif non vérifié individuellement ; cout_nok = NULL,
--     source = 'non_verifie_2026'. Honnêteté R1 : on ne publie pas un chiffre inventé.
--     À alimenter au fur et à mesure des vérifications.
--
-- Taux NOK/EUR : 11.07 (params_budget.taux_eur_nok, source BCE/Wise 15/07/2026).
-- Idempotent (DROP IF EXISTS + ADD COLUMN IF NOT EXISTS + UPDATE avec conditions).
-- Rejouable : psql -h localhost -p 5433 -d norvege_routing -f calc/recette/01_ferry_cout.sql
--
-- Doctrine A14 : entrées = ferry_leg existant + params_budget.taux_eur_nok ;
--               sortie = ferry_leg avec cout_nok/cout_eur/source/annee ;
--               le forfait cout_eur_estime=35 est archivé dans staging puis zéré.

\set ON_ERROR_STOP on
BEGIN;

-- 1. Ajouter les colonnes si absentes.
ALTER TABLE mcda2.ferry_leg ADD COLUMN IF NOT EXISTS cout_nok    numeric;
ALTER TABLE mcda2.ferry_leg ADD COLUMN IF NOT EXISTS cout_eur    numeric;
ALTER TABLE mcda2.ferry_leg ADD COLUMN IF NOT EXISTS source      text;
ALTER TABLE mcda2.ferry_leg ADD COLUMN IF NOT EXISTS annee       smallint;

-- 2. Archiver l'état AVANT dans staging (réversibilité, doctrine A14).
CREATE TABLE IF NOT EXISTS staging.ferry_leg_avant_cout_v1 AS
  SELECT *, now() AS archive_le FROM mcda2.ferry_leg;

-- 3. Initialiser toutes les lignes à "non vérifié" (idempotent : SET uniquement si NULL).
UPDATE mcda2.ferry_leg
SET source = COALESCE(source, 'non_verifie_2026'),
    annee  = COALESCE(annee, 2026);

-- 4. Corridor 6<->74 (74->6 dans ferry_leg) : 198 NOK/sens (sourced M009).
-- Taux EUR/NOK depuis le registre single-source (params_budget).
WITH taux AS (
  SELECT valeur::numeric AS nok_eur FROM public.params_budget WHERE cle = 'taux_eur_nok'
)
UPDATE mcda2.ferry_leg fl
SET cout_nok = 198,
    cout_eur = round(198 / taux.nok_eur, 2),
    source   = 'AutoPASS_ferje_2026_M009_Jektavik-Hodnanes_69NOK_Vage-Halhjem_129NOK',
    annee    = 2026
FROM taux
WHERE (fl.src_base, fl.tgt_base) = (74, 6);

-- Symétrie : 6->74 n'est PAS dans ferry_leg (arête ajoutée dans base_base_routes_v2),
-- mais si un recalcul la produisait on la mettra à jour aussi (clause idempotente).
WITH taux AS (
  SELECT valeur::numeric AS nok_eur FROM public.params_budget WHERE cle = 'taux_eur_nok'
)
UPDATE mcda2.ferry_leg fl
SET cout_nok = 198,
    cout_eur = round(198 / taux.nok_eur, 2),
    source   = 'AutoPASS_ferje_2026_M009_Jektavik-Hodnanes_69NOK_Vage-Halhjem_129NOK',
    annee    = 2026
FROM taux
WHERE (fl.src_base, fl.tgt_base) = (6, 74);

-- 5. Corridor 77->82 : arête invalide van (bateau passagers, R1 M009).
UPDATE mcda2.ferry_leg
SET cout_nok = NULL,
    cout_eur = NULL,
    source   = 'invalide_bateau_passagers_Hardangerfjordekspressen_Rodne_M009',
    annee    = 2026
WHERE (src_base, tgt_base) = (77, 82);

-- 6. Zérer cout_eur_estime pour les lignes maintenant sourcées (garder la colonne pour
-- retrocompat, mais mettre à NULL pour indiquer qu'elle est périmée).
-- On ne DROP pas la colonne (réversibilité, d'autres requêtes v2 pourraient la référencer).
UPDATE mcda2.ferry_leg
SET cout_eur_estime = NULL
WHERE source IS NOT NULL AND source != 'non_verifie_2026';

COMMIT;

-- 7. Vérification (verification-before-completion).
\echo '== 01_ferry_cout : résultat de la mise à jour =='
SELECT
  count(*)                                         AS total,
  count(*) FILTER (WHERE cout_nok IS NOT NULL)     AS sourced_nok,
  count(*) FILTER (WHERE cout_nok IS NULL AND source='invalide_bateau_passagers_Hardangerfjordekspressen_Rodne_M009') AS invalide_van,
  count(*) FILTER (WHERE cout_nok IS NULL AND source='non_verifie_2026') AS non_verifie
FROM mcda2.ferry_leg;

\echo '== Corridor 6<->74 (74->6 attendu avec 198 NOK) =='
SELECT src_base, tgt_base, cout_nok, cout_eur, source, annee, cout_eur_estime
FROM mcda2.ferry_leg
WHERE (src_base, tgt_base) IN ((74, 6), (6, 74))
ORDER BY src_base;

\echo '== Corridor 77->82 (invalide van) =='
SELECT src_base, tgt_base, cout_nok, cout_eur, source, annee
FROM mcda2.ferry_leg
WHERE (src_base, tgt_base) = (77, 82);

\echo '== Taux de couverture du sourcing =='
SELECT
  round(100.0 * count(*) FILTER (WHERE cout_nok IS NOT NULL) / count(*), 1) AS pct_source,
  round(100.0 * count(*) FILTER (WHERE source='invalide_bateau_passagers_Hardangerfjordekspressen_Rodne_M009') / count(*), 1) AS pct_invalide,
  round(100.0 * count(*) FILTER (WHERE source='non_verifie_2026') / count(*), 1) AS pct_non_verifie
FROM mcda2.ferry_leg;
