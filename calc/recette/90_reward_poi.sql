-- 90_reward_poi.sql (tâche A-09, reward de nœud, formule pinée M028/A020).
-- V_poi = tier_base · (1 + w·Q) : le tier est le PLANCHER (un must-see reste haut même à Q basse), Q soulève.
-- Écarte le produit Q×tier (qui écrasait les must-see faible-Q, prouvé A020). Params lus du registre single-source
-- `composeur_params` (reward_tier_base_*, reward_w_qualite). α (atténuation) et φ/ψ (satiété/thème) = composeur runtime,
-- documentés au registre, PAS appliqués ici (le nœud porte V_poi ; le composeur fait r = V_poi^α · φ · ψ).
--
-- Sources : qualite_poi (Q, OWA) + defaut_poi (tier corrigé A019 : proxy_reward → B) + poi.poi (vivants).
-- Couvre les 778 POI avec Q ∩ tier. Idempotent. Usage : psql ... -f calc/recette/90_reward_poi.sql

\set ON_ERROR_STOP on
BEGIN;

DROP TABLE IF EXISTS mcda2.reward_poi;
CREATE TABLE mcda2.reward_poi AS
SELECT q.poi_id,
       d.tier,
       q.qualite                                  AS q,
       tb.soft                                     AS tier_base,
       d.confiance,
       tb.soft * (1 + w.soft * q.qualite)          AS v_poi   -- V_poi = tier_base·(1+w·Q)
FROM mcda2.qualite_poi q
JOIN mcda2.defaut_poi d      ON d.poi_id = q.poi_id
JOIN poi.poi p               ON p.poi_id = q.poi_id AND p.merged_into_poi_id IS NULL
JOIN mcda2.composeur_params tb ON tb.regle = 'reward_tier_base_' || d.tier
CROSS JOIN mcda2.composeur_params w
WHERE w.regle = 'reward_w_qualite';
ALTER TABLE mcda2.reward_poi ADD PRIMARY KEY (poi_id);

COMMENT ON TABLE mcda2.reward_poi IS
  'A-09 : valeur de nœud V_poi = tier_base·(1+w·Q) (M028/A020, registre composeur_params). Tier = plancher, Q soulève. '
  'α/φ/ψ appliqués par le composeur (runtime). 90_reward_poi.sql. Alimente base_reward_inputs + l''orienteering.';

COMMIT;

-- Vérifications.
\echo '== reward_poi : volume + bornes de V_poi =='
SELECT count(*) n, round(min(v_poi)::numeric,3) vmin, round(avg(v_poi)::numeric,3) vmoy, round(max(v_poi)::numeric,3) vmax
FROM mcda2.reward_poi;
\echo '== V_poi par tier (le plancher tier domine, Q module) =='
SELECT tier, count(*), round(min(v_poi)::numeric,3) vmin, round(max(v_poi)::numeric,3) vmax, round(avg(q)::numeric,3) q_moy
FROM mcda2.reward_poi GROUP BY tier ORDER BY tier;
\echo '== PREUVE M028 : un must-see S faible-Q reste au-dessus d un B haute-Q (plancher préservé) =='
(SELECT 'S_faible_Q' cas, poi_id, tier, round(q::numeric,3) q, round(v_poi::numeric,3) v_poi FROM mcda2.reward_poi WHERE tier='S' ORDER BY q ASC LIMIT 2)
UNION ALL
(SELECT 'B_haute_Q', poi_id, tier, round(q::numeric,3), round(v_poi::numeric,3) FROM mcda2.reward_poi WHERE tier='B' ORDER BY q DESC LIMIT 2);
