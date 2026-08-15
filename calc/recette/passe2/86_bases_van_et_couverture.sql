-- 86_bases_van_et_couverture.sql
-- BarjoTur / Worker A — M261 §3 (>=1 base/sous-zone) + §4 (faisabilite nuit-van des bases).
-- STAGING/PREP. La partie VAN se mesure des maintenant (aménités + bases_v2 en base).
-- La partie COUVERTURE attend les sous-zones naturelles (staging.souszones_landskap, 81d) -> push-button.
-- Non destructif. Aucune ecriture canonique. R1 : mesure.

-- ============================================================================
-- A) SCORE NUIT-VAN par base — DOUX (M264), pas un filtre dur. Fonde sur les champs
--    AUTORITAIRES de bases_v2 (deja calcules) : les 104 bases SONT des lieux de nuit
--    (service_type in aire_bobil/camp_pitch/camping) -> van_ok = vrai partout. Le score
--    differencie la redondance/confort (alt_nuitee_10km, autonomie_nature), sans exclure.
-- ============================================================================
DROP TABLE IF EXISTS staging.base_van_score;
CREATE TABLE staging.base_van_score AS
SELECT b.base_id, b.nom, b.service_type,
       (b.service_type IN ('aire_bobil','camp_pitch','camping')) AS est_lieu_nuit,
       b.alt_nuitee_10km, coalesce(b.autonomie_nature,false) AS autonomie_nature, b.nuitees_max,
       -- score doux 0..1 : base-lieu-de-nuit (0.6) + redondance nuitee (0.25) + autonomie (0.15)
       round((
         0.60 * (CASE WHEN b.service_type IN ('aire_bobil','camp_pitch','camping') THEN 1 ELSE 0 END)
       + 0.25 * LEAST(coalesce(b.alt_nuitee_10km,0),5)/5.0
       + 0.15 * (CASE WHEN b.autonomie_nature THEN 1 ELSE 0 END)
       )::numeric, 3) AS van_score,
       true AS van_ok   -- DOUX : jamais d'exclusion sur donnee d'amenite incomplete
FROM mcda2.bases_v2 b;

\echo '--- score nuit-van (DOUX) : toutes dormables, differenciees par redondance ---'
SELECT count(*) total, count(*) FILTER (WHERE est_lieu_nuit) sont_lieu_nuit,
       round(avg(van_score),3) score_moy, round(min(van_score),3) mini, round(max(van_score),3) maxi
FROM staging.base_van_score;

-- ============================================================================
-- B) COUVERTURE >=1 base idéale PAR sous-zone (M261 §3) — PUSH-BUTTON
--    Attend staging.souszones_landskap (81d, apres depot NIBIO). Post-completion :
--    pour chaque sous-zone sans base retenue, ajouter la meilleure candidate van_ok
--    dont le reward couvre la sous-zone. Contrainte douce, mesuree.
-- ============================================================================
-- (bloc a activer quand souszones_landskap existe)
-- WITH sz AS (SELECT sous_zone_id, geom FROM staging.souszones_landskap),
-- base_sz AS (  -- base retenue -> sous-zone qui la contient
--   SELECT s.sous_zone_id, bi.base_id
--   FROM mcda2.bases_ideales bi JOIN mcda2.bases_v2 b ON b.base_id=bi.base_id
--   JOIN sz s ON ST_Contains(s.geom, b.geom) WHERE bi.retenue),
-- vides AS (SELECT sous_zone_id, geom FROM sz WHERE sous_zone_id NOT IN (SELECT sous_zone_id FROM base_sz))
-- -- pour chaque sous-zone vide : candidate van_ok la mieux notee (reward) dont le point tombe dans la sous-zone
-- SELECT v.sous_zone_id,
--        (SELECT b.base_id FROM mcda2.bases_v2 b
--         JOIN staging.base_van_score e ON e.base_id=b.base_id AND e.van_ok
--         JOIN mcda2.base_reward r ON r.base_id=b.base_id
--         WHERE ST_Contains(v.geom, b.geom) ORDER BY r.reward_atteignable DESC LIMIT 1) AS base_a_ajouter
-- FROM vides v;
-- Assertion finale visee : 0 sous-zone sans base (apres complétion).
\echo '--- (B) couverture par sous-zone : en attente de staging.souszones_landskap (NIBIO) ---'
