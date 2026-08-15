-- 74_promotion_base_reward_v5.sql, PROMOTION du base_reward fc≤5 + tampon-frontière (M194 GO option A, sanity >95%).
-- v5 : base 1 → 100%, bases 40/50/80 → 100%, 2 bases 0-reward restantes (5,63) HONNÊTES (full-graph = 0 POI scoré).
-- corr v5/v4 = 0,978 (raffinement, rangs préservés). Empreinte v5 6a1a26e3. BACKUP AVANT REMPLACEMENT (R1).
-- Promeut : base_reward_v5 → mcda2.base_reward ; reward_poi_v3 → mcda2.reward_poi (+ drapeau tres_frequente A35).
-- Usage : PGOPTIONS="-c client_min_messages=warning -c extra_float_digits=3" psql -h localhost -p 5433 -d norvege_routing -v ON_ERROR_STOP=1 -f calc/recette/74_promotion_base_reward_v5.sql
\set ON_ERROR_STOP on
BEGIN;

-- 1. BACKUPS (rejouables : drop-if-exists puis snapshot du canonique actuel = v2)
DROP TABLE IF EXISTS staging.base_reward_backup_pre_v5;
CREATE TABLE staging.base_reward_backup_pre_v5 AS SELECT * FROM mcda2.base_reward;
DROP TABLE IF EXISTS staging.reward_poi_backup_pre_v5;
CREATE TABLE staging.reward_poi_backup_pre_v5 AS SELECT * FROM mcda2.reward_poi;
\echo '== backups créés (base_reward + reward_poi pre-v5) =='
SELECT (SELECT count(*) FROM staging.base_reward_backup_pre_v5) br_bak, (SELECT count(*) FROM staging.reward_poi_backup_pre_v5) rp_bak;

-- 2. PROMOTION base_reward (schéma canonique conservé : base_id, reward_atteignable, n_poi, v_max, params)
DELETE FROM mcda2.base_reward;
INSERT INTO mcda2.base_reward(base_id, reward_atteignable, n_poi, v_max, params)
SELECT base_id, reward_atteignable, n_clusters, v_max,
       'fc5+tampon_frontiere_2km|reach90min_exact|Vpoi_M119|Q_herite_v2|empreinte_6a1a26e3'
FROM mcda2.base_reward_v5;
COMMENT ON TABLE mcda2.base_reward IS 'CANONIQUE (promu 15/08 depuis base_reward_v5). Σ V_poi atteignables graphe van CONTRACTÉ fc≤5, reachability tampon dernier-km 2km à la frontière (90min EXACT). V_poi figée M119. Q hérité v2. Empreinte 6a1a26e3. base 1/40/50/80=100% sanity ; 2 bases 0-reward (5,63) honnêtes (0 POI scoré full-graph).';

-- 3. PROMOTION reward_poi. Le canonique portait 6 col legacy (tier_base numérique 0-1, v2) ; on l'aligne sur le payload
-- v3 en AJOUTANT les colonnes manquantes (additif, non cassant). tier_base = lib.facteur_avis(tier) (facteur du modèle
-- V_poi M119, documenté). q_std/q_manquant/budget_min repris de v3.
ALTER TABLE mcda2.reward_poi ADD COLUMN IF NOT EXISTS q_std numeric;
ALTER TABLE mcda2.reward_poi ADD COLUMN IF NOT EXISTS q_manquant boolean;
ALTER TABLE mcda2.reward_poi ADD COLUMN IF NOT EXISTS budget_min integer;
ALTER TABLE mcda2.reward_poi ADD COLUMN IF NOT EXISTS tres_frequente boolean DEFAULT false;
DELETE FROM mcda2.reward_poi;
INSERT INTO mcda2.reward_poi(poi_id, tier, q, tier_base, confiance, v_poi, q_std, q_manquant, budget_min)
SELECT poi_id, tier, q, lib.facteur_avis(tier), confiance, v_poi, q_std, q_manquant, budget_min FROM mcda2.reward_poi_v3;
COMMENT ON TABLE mcda2.reward_poi IS 'CANONIQUE (promu 15/08 depuis reward_poi_v3). V_poi = facteur_avis(tier)·(1+0,5·Q_std), Q_std percentile rank, figée M119. tier_base = lib.facteur_avis(tier) (facteur du modèle, remplace le 0-1 v2). Q hérité v2. Avant remap votes Passe 2.';

-- 4. DRAPEAU « très fréquenté » (A35/M174/M175 : incontournables majeurs, dérivé tier T/S + notoriété, pas de calcul lourd)
UPDATE mcda2.reward_poi rp SET tres_frequente = (rp.tier IN ('T','S') OR coalesce(p.score_frequentation,0) >= 5)
FROM poi.poi p WHERE p.poi_id = rp.poi_id;
COMMENT ON COLUMN mcda2.reward_poi.tres_frequente IS 'Incontournable majeur / affluence (A35) : tier T/S OU score_frequentation>=5. Nourrit les alternatives pépites (Q hors_foule).';

COMMIT;

\echo '== CANONIQUE promu : base_reward =='
SELECT count(*) bases, round(avg(reward_atteignable)::numeric,1) moy, round(max(reward_atteignable)::numeric,1) mx, count(*) FILTER (WHERE reward_atteignable=0) zero FROM mcda2.base_reward;
\echo '== CANONIQUE promu : reward_poi + drapeau =='
SELECT count(*) pois, count(*) FILTER (WHERE tres_frequente) tres_frequente, round(avg(v_poi)::numeric,3) v_moy FROM mcda2.reward_poi;
\echo '== empreinte canonique base_reward (gel) =='
SELECT md5(string_agg(md5(t.*::text), '' ORDER BY base_id)) FROM (SELECT base_id, reward_atteignable, n_poi FROM mcda2.base_reward) t;
\echo '== empreinte canonique reward_poi (gel) =='
SELECT md5(string_agg(md5(t.*::text), '' ORDER BY poi_id)) FROM (SELECT poi_id, v_poi, tier, tres_frequente FROM mcda2.reward_poi) t;
