-- patch_ferry_cout_reel.sql (tâche loop A-01)
-- Couche € réelle des tronçons ferry sur mcda2.ferry_leg (ruling M012 : ferry_leg conservé = entité,
-- le coût est une COLONNE). Remplace le forfait R1-faux cout_eur_estime=35 (uniforme sur 78 lignes) par
-- des montants NOK RÉELS sourcés (AutoPASS ferje 2026, M009). Aucun montant inventé (R1).
--
-- Idempotent (ADD COLUMN IF NOT EXISTS, UPDATE par clé), réversible (backup staging du forfait avant retrait).
-- Non destructif : on n'efface pas le forfait, on le déprécie (valeurs → NULL, sauvegardées en staging).
--
-- R1 / limites assumées :
--   - Seul le corridor 6<->74 est sourcé (198 NOK/sens = 69 Jektavik-Hodnanes + 129 Vage-Halhjem, M009).
--   - 77->82 (corridor 82<->77) : NON chiffré ici, l'arête actuelle est un bateau PASSAGERS (Rodne), à
--     re-router par le car-ferry Vage-Halhjem (~129 NOK) avant de figer (M009 R1).
--   - Les 76 autres tronçons ferry : cout_nok NULL (tarifs à sourcer, tâche M). Le forfait 35 EUR est retiré
--     partout (il masquait l'inconnu par une fausse valeur uniforme).
--   - cout_eur : dérivé de cout_nok au taux NOK->EUR du registre single-source. Ce taux N'EXISTE PAS encore
--     (registre = forfait/budget seulement). cout_eur reste NULL tant qu'un taux SOURCÉ n'est pas au registre.
--
-- Usage :  psql -h localhost -p 5433 -d norvege_routing -f calc/recette/patch_ferry_cout_reel.sql

\set ON_ERROR_STOP on
BEGIN;

-- 1. Colonnes de coût réel (idempotent).
ALTER TABLE mcda2.ferry_leg ADD COLUMN IF NOT EXISTS cout_nok numeric;
ALTER TABLE mcda2.ferry_leg ADD COLUMN IF NOT EXISTS cout_eur numeric;   -- dérivé au taux registre (NULL tant que pas de taux sourcé)
ALTER TABLE mcda2.ferry_leg ADD COLUMN IF NOT EXISTS source   text;
ALTER TABLE mcda2.ferry_leg ADD COLUMN IF NOT EXISTS annee    int;
COMMENT ON COLUMN mcda2.ferry_leg.cout_nok IS 'Coût véhicule <=6 m par sens, NOK réels (AutoPASS ferje). NULL = non sourcé.';
COMMENT ON COLUMN mcda2.ferry_leg.cout_eur IS 'Dérivé de cout_nok au taux NOK->EUR du registre single-source. NULL tant que le taux sourcé manque.';
COMMENT ON COLUMN mcda2.ferry_leg.cout_eur_estime IS 'DÉPRÉCIÉ (M012) : forfait R1-faux 35 EUR uniforme. Retiré ; sauvegarde staging.bak_ferry_leg_forfait. À supprimer au recompute canonique.';

-- 2. Sauvegarde du forfait avant retrait (réversibilité).
CREATE TABLE IF NOT EXISTS staging.bak_ferry_leg_forfait AS
  SELECT src_base, tgt_base, cout_eur_estime, now() AS sauve_le
  FROM mcda2.ferry_leg WHERE false;
INSERT INTO staging.bak_ferry_leg_forfait (src_base, tgt_base, cout_eur_estime)
  SELECT src_base, tgt_base, cout_eur_estime FROM mcda2.ferry_leg
  WHERE cout_eur_estime IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM staging.bak_ferry_leg_forfait b
                    WHERE b.src_base=ferry_leg.src_base AND b.tgt_base=ferry_leg.tgt_base);

-- 3. Corridor 6<->74 sourcé (le tronçon présent est le retour 74->6). 198 NOK/sens.
UPDATE mcda2.ferry_leg
   SET cout_nok = 198,
       source   = 'AutoPASS ferje 2026 : Jektavik-Hodnanes 69 NOK + Vage-Halhjem 129 NOK (M009)',
       annee    = 2026
 WHERE src_base = 74 AND tgt_base = 6;

-- 4. Corridor 82<->77 : non chiffré (arête = bateau passagers, re-route requis). Trace le caveat.
UPDATE mcda2.ferry_leg
   SET cout_nok = NULL,
       source   = 'EN ATTENTE re-route Vage-Halhjem (M009 R1 : arete actuelle = bateau passagers Rodne). ~129 NOK apres re-route.',
       annee    = 2026
 WHERE src_base = 77 AND tgt_base = 82;

-- 5. Retrait du forfait R1-faux partout (valeurs -> NULL, déjà sauvegardées).
UPDATE mcda2.ferry_leg SET cout_eur_estime = NULL WHERE cout_eur_estime IS NOT NULL;

COMMIT;

-- Vérification (verification-before-completion).
\echo '== Colonnes ajoutees =='
SELECT column_name FROM information_schema.columns
 WHERE table_schema='mcda2' AND table_name='ferry_leg'
   AND column_name IN ('cout_nok','cout_eur','source','annee') ORDER BY column_name;
\echo '== Corridors 6<->74 et 82<->77 =='
SELECT src_base, tgt_base, cout_nok, cout_eur, annee, left(source,48) AS source FROM mcda2.ferry_leg
 WHERE (src_base,tgt_base) IN ((74,6),(77,82)) ORDER BY src_base;
\echo '== Forfait retire (attendu : 0 ligne avec cout_eur_estime non NULL ; 78 sauvegardees en staging) =='
SELECT (SELECT count(*) FROM mcda2.ferry_leg WHERE cout_eur_estime IS NOT NULL) AS reste_forfait,
       (SELECT count(*) FROM staging.bak_ferry_leg_forfait) AS sauvegardes;
\echo '== Couverture tarifaire (attendu : 1 sourcee sur 78, le reste a sourcer) =='
SELECT count(*) FILTER (WHERE cout_nok IS NOT NULL) AS sourcees, count(*) AS total FROM mcda2.ferry_leg;
