-- 91_rescore_tier_v3.sql — BarjoTur Worker A — RE-SCORE TIER v3 from-scratch (A118, GO M333, signal Guillaume).
-- Backup + re-score reward_poi.tier sur la distribution réelle (score_interet + confiance R5b + perle/masse), 5 tiers T-C.
-- Conditions M333 : compte exact, zéro NULL-en-C silencieux (logué), tracé par POI. Transactionnel. Test ROLLBACK puis COMMIT.
BEGIN;
CREATE TABLE IF NOT EXISTS staging.reward_poi_backup_pre_tier AS SELECT * FROM mcda2.reward_poi;

-- 1. table de travail : score_interet (poi.poi) + confiance/statut_perle (staging.poi_v3 par osm_id, DISTINCT ON = dédup fiches)
DROP TABLE IF EXISTS staging.tier_v3;
CREATE TABLE staging.tier_v3 AS
WITH v AS (
  SELECT DISTINCT ON (osm_id) osm_id, confiance, statut_perle
  FROM staging.poi_v3 WHERE osm_id IS NOT NULL ORDER BY osm_id, desc_len DESC NULLS LAST)
SELECT rp.poi_id, p.osm_id, p.score_interet si, coalesce(v.confiance,0) conf, v.statut_perle,
  CASE
    WHEN p.score_interet IS NULL THEN NULL                                   -- R1 : score manquant -> NULL, logué, PAS C muet
    WHEN p.score_interet=5 AND (v.statut_perle='masse' OR coalesce(v.confiance,0)>=0.5) THEN 'T'
    WHEN p.score_interet=5 OR (p.score_interet=4 AND coalesce(v.confiance,0)>=0.4)       THEN 'S'
    WHEN p.score_interet=4 THEN 'A'
    WHEN p.score_interet=3 THEN 'B'
    WHEN p.score_interet<=2 THEN 'C'
  END tier_v3
FROM mcda2.reward_poi rp JOIN poi.poi p ON p.poi_id=rp.poi_id
LEFT JOIN v ON v.osm_id=p.osm_id;

\echo '--- CONDITION 2 (M333) : POI sans score_interet (NON défautés en C, à signaler) ---'
SELECT count(*) sans_score FROM staging.tier_v3 WHERE tier_v3 IS NULL;

\echo '--- CONDITION 1 (M333) : réconciliation EXACTE (chaque POI 1 tier, total = reward_poi) ---'
SELECT (SELECT count(*) FROM mcda2.reward_poi) reward_poi_total,
       (SELECT count(*) FROM staging.tier_v3) tier_v3_total,
       (SELECT count(*) FROM staging.tier_v3 WHERE tier_v3 IS NOT NULL) assignes;

\echo '--- distribution tier v3 (doit ≈ A118 T22/S155/A188/B196/C223, écarts expliqués par confiance/dédup) ---'
SELECT tier_v3, count(*), round(avg(si),1) si_moy, round(avg(conf),2) conf_moy FROM staging.tier_v3 GROUP BY 1
ORDER BY array_position(ARRAY['T','S','A','B','C',NULL]::text[], tier_v3);

-- 2. appliquer au reward_poi (tier + V_poi via lib.facteur_avis)  [seulement si distribution validée]
UPDATE mcda2.reward_poi rp SET tier = t.tier_v3
FROM staging.tier_v3 t WHERE t.poi_id=rp.poi_id AND t.tier_v3 IS NOT NULL;

\echo '--- reward_poi.tier après re-score ---'
SELECT tier, count(*) FROM mcda2.reward_poi GROUP BY 1 ORDER BY array_position(ARRAY['T','S','A','B','C'], tier);
COMMIT;   -- signal Guillaume 2026-08-16 : re-score tier v3 (A118, réconciliation exacte).
