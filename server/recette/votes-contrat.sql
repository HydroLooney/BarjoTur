-- Recette de contrat api.* votes (garde zéro perte pour la migration Q11, cf B006).
-- Lecture seule. À passer sur DB2 AVANT et APRÈS le renommage physique : la sortie doit être IDENTIQUE.
-- Le BFF ne dépendant que de api.*, un contrat stable = bascule sans perte et sans toucher server/.
--   Usage : docker exec norvege-db psql -U norvege -d norvege_v2 -f votes-contrat.sql
-- Réglage : renseigner un code_lien owner via \set (sinon on prend l'owner en base pour les vérifs de forme).

\pset pager off
\set ON_ERROR_STOP on

\echo '== 1. Empreinte de comptage (doit être identique avant/après) =='
SELECT 'vote_lieu'     AS table, count(*) AS n FROM decision.vote_lieu
UNION ALL SELECT 'vote_circuit',  count(*) FROM decision.vote_circuit
UNION ALL SELECT 'vote_variante', count(*) FROM decision.vote_variante
UNION ALL SELECT 'esprit',        count(*) FROM decision.esprit
ORDER BY 1;

\echo '== 2. Empreinte par membre (zéro perte individuel) =='
SELECT m.prenom,
       (SELECT count(*) FROM decision.vote_lieu     v WHERE v.membre_id=m.membre_id) AS lieux,
       (SELECT count(*) FROM decision.vote_circuit  v WHERE v.membre_id=m.membre_id) AS circuits,
       (SELECT count(*) FROM decision.vote_variante v WHERE v.membre_id=m.membre_id) AS variantes
FROM membre.membre m ORDER BY m.membre_id;

\echo '== 3. Contrôle de l historisation (les *_hist ne rétrécissent jamais) =='
SELECT 'vote_lieu_hist'     AS hist, count(*) AS n FROM decision.vote_lieu_hist
UNION ALL SELECT 'vote_circuit_hist',  count(*) FROM decision.vote_circuit_hist
UNION ALL SELECT 'vote_variante_hist', count(*) FROM decision.vote_variante_hist
ORDER BY 1;

\echo '== 4. Triggers présents (dirty + hist) sur chaque table de vote (attendu : 6 lignes) =='
SELECT event_object_table, trigger_name
FROM information_schema.triggers
WHERE trigger_schema='decision' AND event_object_table LIKE 'vote_%'
GROUP BY 1,2 ORDER BY 1,2;

\echo '== 5. Contrat de FORME api.* (booléens, tous attendus à t) =='
SELECT
  -- mes_votes rend un objet avec la clé tiers
  (api.mes_votes((SELECT code_lien FROM membre.membre WHERE role='owner')) ? 'tiers')            AS mes_votes_a_tiers,
  -- code inconnu => NULL
  (api.mes_votes('code-inexistant-xyz') IS NULL)                                                 AS mes_votes_inconnu_null,
  -- whoami rend membre_id/prenom/role
  (api.whoami((SELECT code_lien FROM membre.membre WHERE role='owner')) ?& array['membre_id','prenom','role']) AS whoami_complet,
  -- tous les tiers observés sont dans l alphabet attendu T/S/A/B/C/D
  (NOT EXISTS (SELECT 1 FROM (
      SELECT tier FROM decision.vote_lieu
      UNION ALL SELECT tier FROM decision.vote_circuit
      UNION ALL SELECT tier FROM decision.vote_variante) t
    WHERE t.tier NOT IN ('T','S','A','B','C','D')))                                              AS tiers_dans_alphabet,
  -- base_vote_weight borné [-0.3, 0.5]
  (NOT EXISTS (SELECT 1 FROM api.base_vote_weight WHERE vote_weight < -0.3 OR vote_weight > 0.5)) AS poids_bornes;
