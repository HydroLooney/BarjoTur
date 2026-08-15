-- 70_base_reward.sql, RECOMPUTE base_reward (M101/M111 option B + REVIEW cœur M119). V_poi FIGÉE canonique (A14).
-- V_poi = facteur_avis(tier) · (1 + w·Q_std)  — Q STANDARDISÉ (rang percentile), w réglable.
--   confiance / thème / durée = HORS de la valeur (modulateurs composeur, pas de la valeur) — M119.
--   plancher jamais violé. Q hérité v2 (reward_inputs.q, documenté rejouable, option B M111).
-- base_reward = Σ des V_poi ATTEIGNABLES (van reach), cluster-dédup 0 m (compte une fois). Pas de pondération durée (double peine).
-- Lissage = « lissage de noyau réseau » v2 hérité (PAS un krigeage : pas de variogramme). NON destructif (tables _v3).
-- Usage : PGOPTIONS="-c client_min_messages=warning -c extra_float_digits=3" psql -h localhost -p 5433 -d norvege_routing -v ON_ERROR_STOP=1 -f calc/recette/70_base_reward.sql
\set ON_ERROR_STOP on

-- Params VALEUR (single-source, tunables). Uniquement ce qui entre dans V_poi + le rayon d'accessibilité.
INSERT INTO mcda2.routing_params(profil,param,valeur,unite,description) VALUES
 ('reward','q_poids',0.5,'-','V_poi = facteur_avis(tier)·(1+q_poids·Q_std), Q_std=rang percentile — M119'),
 ('reward','q_impute_quantile',0.10,'-','Politique NULL unique : Q manquant → quantile bas 0,10 + drapeau (M119)'),
 ('reward','reach_max_s',3600,'s','Rayon reachability van pour reward_atteignable (60 min)')
ON CONFLICT DO NOTHING;

-- 1. POI actifs snappés au noeud van, avec TAMPON van (M150 : POI atteint si son noeud ≤ tampon 250 m). Cluster 0 m.
DROP TABLE IF EXISTS staging.poi_van_node;
CREATE TABLE staging.poi_van_node AS
SELECT p.poi_id, s.node AS node_van, round(s.d::numeric,0) AS snap_m,
       ST_SnapToGrid(ST_Transform(p.geom,25833), 50) AS cluster_key
FROM poi.poi p
CROSS JOIN LATERAL (
  SELECT n.node, ST_Distance(n.geom, ST_Transform(p.geom,25833)) d
  FROM staging.ruteplan_node n ORDER BY n.geom <-> ST_Transform(p.geom,25833) LIMIT 1) s
WHERE p.merged_into_poi_id IS NULL AND p.geom IS NOT NULL
  AND s.d <= (SELECT valeur FROM mcda2.routing_params WHERE profil='van' AND param='iso_tampon_m');  -- tampon van M150
CREATE INDEX ON staging.poi_van_node(node_van);
CREATE INDEX ON staging.poi_van_node(poi_id);

-- 2. V_poi FIGÉE : Q standardisé (rang percentile), tier 6 codes. confiance/durée = colonnes INFO, HORS valeur.
DROP TABLE IF EXISTS mcda2.reward_poi_v3;
CREATE TABLE mcda2.reward_poi_v3 AS
WITH qn AS (
  SELECT poi_id, tier, q, confiance,
         percent_rank() OVER (ORDER BY q) AS q_std,      -- standardisation [0,1] robuste
         (q IS NULL) AS q_manquant
  FROM mcda2.reward_inputs
), w AS (SELECT valeur qp FROM mcda2.routing_params WHERE profil='reward' AND param='q_poids'),
   imp AS (SELECT valeur iq FROM mcda2.routing_params WHERE profil='reward' AND param='q_impute_quantile')
SELECT qn.poi_id, qn.tier, qn.q,
  round(coalesce(qn.q_std,(SELECT iq FROM imp))::numeric,4) AS q_std,
  qn.q_manquant,
  qn.confiance,                                            -- INFO : modulateur composeur, PAS dans la valeur
  bt.defaut_min AS budget_min,                             -- INFO : contrainte composeur, PAS dans la valeur
  round((lib.facteur_avis(qn.tier) * (1 + (SELECT qp FROM w)*coalesce(qn.q_std,(SELECT iq FROM imp))))::numeric,4) AS v_poi
FROM qn
LEFT JOIN diffusion.v_web_poi_activite bt ON bt.poi_id = qn.poi_id
JOIN poi.poi po ON po.poi_id=qn.poi_id AND po.merged_into_poi_id IS NULL;
CREATE INDEX ON mcda2.reward_poi_v3(poi_id);
COMMENT ON TABLE mcda2.reward_poi_v3 IS 'V_poi FIGÉE M119 : facteur_avis(tier 6 codes)·(1+0,5·Q_std), Q_std=rang percentile, Q hérité v2. confiance/durée = INFO hors valeur. v1 14/08.';

-- 3. base_reward = Σ des V_poi atteignables (van reach_max_s), cluster-dédup (max V_poi par cluster). PAS de poids durée.
DROP TABLE IF EXISTS mcda2.base_reward_v3;
CREATE TABLE mcda2.base_reward_v3(base_id int, reward_atteignable numeric, n_poi int, n_clusters int, v_max numeric);
DO $$
DECLARE b RECORD; rmax int := (SELECT valeur*60 FROM mcda2.routing_params WHERE profil='van' AND param='reach_seuil_min');  -- van 90min → 5400s (M150)
BEGIN
  FOR b IN SELECT brn.base_id, brn.node_ruteplan FROM staging.base_ruteplan_node brn ORDER BY brn.base_id LOOP
    INSERT INTO mcda2.base_reward_v3
    WITH reached AS (
      SELECT DISTINCT pv.cluster_key, rp.v_poi
      FROM pgr_drivingDistance('SELECT id, source, target, cost_s AS cost, reverse_cost_s AS reverse_cost FROM staging.ways_ruteplan',
             b.node_ruteplan, rmax, directed:=true) d
      JOIN staging.poi_van_node pv ON pv.node_van = d.node
      JOIN mcda2.reward_poi_v3 rp ON rp.poi_id = pv.poi_id
    ),
    dedup AS (SELECT cluster_key, max(v_poi) v_c FROM reached GROUP BY cluster_key)
    SELECT b.base_id, round(coalesce(sum(v_c),0)::numeric,3), (SELECT count(*) FROM reached), count(*)::int, round(coalesce(max(v_c),0)::numeric,3)
    FROM dedup;
  END LOOP;
END $$;
CREATE INDEX ON mcda2.base_reward_v3(base_id);
COMMENT ON TABLE mcda2.base_reward_v3 IS 'base_reward M119 : Σ V_poi atteignables (van 60min), cluster-dédup 0m. Durée/confiance = modulateurs composeur (hors valeur). v1 14/08.';

-- 4. Vérifs + écart C17 vs v2.
\echo '== V_poi FIGÉE : distribution (confiance/durée hors valeur) =='
SELECT round(min(v_poi)::numeric,3) mn, round(avg(v_poi)::numeric,3) moy, round(max(v_poi)::numeric,3) mx,
       count(*) FILTER (WHERE q_manquant) q_imputes, count(*) FROM mcda2.reward_poi_v3;
\echo '== base_reward v3 : reward atteignable + dédup 0m =='
SELECT count(*) bases, round(avg(reward_atteignable)::numeric,1) moy, round(min(reward_atteignable)::numeric,1) mn, round(max(reward_atteignable)::numeric,1) mx,
       round(avg(n_poi-n_clusters)::numeric,0) doublons_evites_moy FROM mcda2.base_reward_v3;
\echo '== écart C17 : corrélation ordre v3 vs v2 =='
SELECT count(*) bases, round(corr(v3.reward_atteignable, v2.reward_atteignable)::numeric,3) correlation
FROM mcda2.base_reward_v3 v3 JOIN mcda2.base_reward v2 USING(base_id);
\echo '== empreinte base_reward_v3 =='
SELECT md5(string_agg(md5(t.*::text), '' ORDER BY base_id)) FROM (SELECT base_id, reward_atteignable, n_poi, n_clusters FROM mcda2.base_reward_v3) t;
