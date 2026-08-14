-- 80_reward_inputs.sql (tâche A-09, volet « reward_inputs » = les FACTEURS bruts par POI, prêts au composeur).
-- Consolide en une table unique les entrées de la récompense de nœud, SANS figer la formule de combinaison
-- (V_poi), qui est une décision de single-source (reward_node) escaladée à M (A020). C'est le socle honnête :
-- les inputs sont canoniques et vérifiés ; la reward finale se calcule dessus quand M a tranché V_poi.
--
-- POURQUOI ne pas figer V_poi ici (R1) : la définition du VALEUR de nœud fourche, et le choix change tout.
--   * Doc 16 (doctrine) : r_i = V_i^α · φ(confiance) · ψ(thème) — Q n'apparaît PAS (la valeur = le VOTE V).
--   * Backlog A-09 : V^α · φ · ψ · Q (Q facteur séparé).
--   * Registre operationnel (composeur_params) : reward_net = V_poi − sensibilite_prix×(cout/cout_ref),
--     thème ×(1+poids_theme×theme_match) — mais NE définit pas V_poi lui-même.
-- Le piège prouvé : V_poi = Q×tier écraserait un incontournable à faible qualité paysagère (Bryggen Bergen = tier
-- S, Q OWA ≈ 0,285) — or le tier existe justement pour porter la renommée INDÉPENDAMMENT de Q (A-10). Un produit
-- laisse Q mettre un veto sur un must-see ; un additif ou une base-vote préserve le must-see. Décision = M.
--
-- Ce que je fige donc : les facteurs (Q, tier + ordinal, coût), orthogonaux et tracés. poi.poi read-only,
-- couche dérivée. Couvre les POI ayant une qualité (785) ∩ un tier (defaut_poi) = 778. Les POI sentiers sans Q
-- (turrutebasen) sont hors périmètre tant que Q ne leur est pas calculée (étape 2/krigeage) — signalé à M.
-- Idempotent. Usage : psql -h localhost -p 5433 -d norvege_routing -v ON_ERROR_STOP=1 -f calc/recette/80_reward_inputs.sql

\set ON_ERROR_STOP on
BEGIN;

DROP TABLE IF EXISTS mcda2.reward_inputs;
CREATE TABLE mcda2.reward_inputs (
  poi_id          bigint PRIMARY KEY,
  q               double precision NOT NULL,   -- qualité OWA (mcda2.qualite_poi) : facteur qualité
  tier            text NOT NULL,               -- prior de vote (mcda2.defaut_poi) : renommée, ⊥ Q
  tier_ord        smallint NOT NULL,           -- ordinal du tier (S=4>A=3>B=2>T=1), pour toute combinaison V_poi
  confiance       double precision NOT NULL,   -- φ input (defaut_poi.confiance)
  cout_estime_eur numeric,                     -- pour la contrainte prix du composeur (sensibilite_prix, registre)
  cout_source     text,
  categorie       text                         -- pour ψ(thème)/theme_match au composeur (runtime, par archétype)
);

INSERT INTO mcda2.reward_inputs (poi_id, q, tier, tier_ord, confiance, cout_estime_eur, cout_source, categorie)
SELECT q.poi_id, q.qualite, d.tier,
       CASE d.tier WHEN 'S' THEN 4 WHEN 'A' THEN 3 WHEN 'B' THEN 2 WHEN 'T' THEN 1 END,
       d.confiance, p.cout_estime_eur, p.cout_source, p.categorie
FROM mcda2.qualite_poi q
JOIN mcda2.defaut_poi d ON d.poi_id=q.poi_id
JOIN poi.poi p ON p.poi_id=q.poi_id
WHERE p.merged_into_poi_id IS NULL;

COMMENT ON TABLE mcda2.reward_inputs IS
  'A-09 : facteurs bruts de la récompense de nœud par POI (Q, tier+ordinal, confiance φ, coût, catégorie). '
  'La combinaison V_poi (produit/additif/vote-only) N''EST PAS figée ici : single-source reward_node = décision M (A020). '
  '80_reward_inputs.sql. Couvre les POI avec qualité ∩ tier (778) ; sentiers sans Q hors périmètre.';

COMMIT;

-- Vérifications (verification-before-completion).
\echo '== reward_inputs : volume + bornes des facteurs =='
SELECT count(*) n, round(min(q)::numeric,3) q_min, round(max(q)::numeric,3) q_max,
       round(min(confiance)::numeric,2) phi_min, round(max(confiance)::numeric,2) phi_max,
       count(*) FILTER (WHERE cout_estime_eur IS NOT NULL) avec_cout
FROM mcda2.reward_inputs;
\echo '== répartition par tier (ordinal) =='
SELECT tier, tier_ord, count(*), round(avg(q)::numeric,3) q_moy, round(avg(confiance)::numeric,2) phi_moy
FROM mcda2.reward_inputs GROUP BY 1,2 ORDER BY tier_ord DESC;
\echo '== le piège Bryggen : un tier S peut-il avoir une faible Q ? (doit exister → prouve que produit Q×tier serait faux) =='
SELECT poi_id, tier, round(q::numeric,3) q, categorie FROM mcda2.reward_inputs WHERE tier='S' ORDER BY q ASC LIMIT 3;
