-- patch_taux_nok_eur_registre.sql (tâche loop A-16)
-- Single-source (A08/A14) : le taux NOK->EUR doit vivre au registre, pas baké dans un UPDATE.
-- Il était dans public.params_budget (table LEGACY à supprimer, A-13) : taux_eur_nok = 11.07 NOK/EUR,
-- sourcé BCE/Wise au 2026-07-15. On le remonte dans le registre canonique mcda2.composeur_params, avec
-- provenance, puis on recalcule ferry_leg.cout_eur DEPUIS le registre (remplace le 0.09035 baké).
--
-- Idempotent (ON CONFLICT), réversible (le taux reste dans params_budget jusqu'à sa suppression A-13).
-- Usage : psql -h localhost -p 5433 -d norvege_routing -v ON_ERROR_STOP=1 -f calc/recette/patch_taux_nok_eur_registre.sql

\set ON_ERROR_STOP on
BEGIN;

-- 1. Poser le taux au registre canonique (regle = clé). soft = valeur (NOK par EUR).
--    composeur_params n'a pas de contrainte unique sur regle : DELETE+INSERT = idempotent.
DELETE FROM mcda2.composeur_params WHERE regle='taux_eur_nok';
INSERT INTO mcda2.composeur_params (regle, soft, unite, description)
VALUES ('taux_eur_nok', 11.07, 'NOK/EUR',
        'Taux EUR/NOK sourcé BCE/Wise au 2026-07-15 ; re-vérifier à J-6 mois. '
        'Remonté de public.params_budget au registre single-source (A-16). cout_eur = cout_nok / taux.');

-- 2. Recalculer ferry_leg.cout_eur DEPUIS le registre (plus de taux baké).
UPDATE mcda2.ferry_leg fl
   SET cout_eur = round(fl.cout_nok / (SELECT soft FROM mcda2.composeur_params WHERE regle='taux_eur_nok'), 2)
 WHERE fl.cout_nok IS NOT NULL;

COMMIT;

-- Vérification.
\echo '== Taux au registre =='
SELECT regle, soft, unite, left(description,55) FROM mcda2.composeur_params WHERE regle='taux_eur_nok';
\echo '== cout_eur recalculé depuis le registre (74->6 : 198 NOK / 11.07 = 17.89 EUR) =='
SELECT src_base, tgt_base, cout_nok, cout_eur FROM mcda2.ferry_leg WHERE cout_nok IS NOT NULL;
