-- Recette de contrat Q11 — exposition du vocabulaire voyageur_* au contrat api.* (M012, B006).
-- Lecture seule. À passer sur DB2 AVANT et APRÈS toute mise à jour du schéma api.*.
-- Aucun rename physique des tables decision.vote_* ou membre.membre (décision M012 §Rulings C02).
-- Le BFF ne dépend que de api.* ; cette recette vérifie la FORME et non les tables physiques.
--
--   Usage : docker exec norvege-db psql -U norvege -d norvege_v2 -f votes-contrat-q11.sql
--   Attendu : TOUS les booléens à "t" (vrai).

\pset pager off
\set ON_ERROR_STOP on

\echo '== 1. Forme api.whoami : retourne bien les champs voyageur (membre_id / prenom / role) =='
SELECT
  (api.whoami((SELECT code_lien FROM membre.membre WHERE role='owner'))
    ?& array['membre_id','prenom','role']) AS whoami_vocabulaire_voyageur;

\echo '== 2. Forme api.mes_votes : retourne bien le champ tiers =='
SELECT
  (api.mes_votes((SELECT code_lien FROM membre.membre WHERE role='owner')) ? 'tiers') AS mes_votes_tiers_present;

\echo '== 3. Vocabulaire voyageur_* — si des fonctions api.voyageur_* ont été créées, vérifier leur présence =='
-- NB : au stade C06 (B006 / M012), il n'y a PAS encore de fonctions api.voyageur_* physiques ;
-- le vocabulaire est exposé par le BFF via l'allowlist. Cette section est un marqueur pour les ajouts futurs.
SELECT
  count(*) AS n_fonctions_voyageur_dans_api
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'api' AND p.proname LIKE 'voyageur_%';

\echo '== 4. Empreinte de comptage de votes (zéro perte, identique avant/après renommage éventuel) =='
SELECT 'vote_lieu'     AS table_vote, count(*) AS n FROM decision.vote_lieu
UNION ALL SELECT 'vote_circuit',  count(*) FROM decision.vote_circuit
UNION ALL SELECT 'vote_variante', count(*) FROM decision.vote_variante
UNION ALL SELECT 'esprit',        count(*) FROM decision.esprit
ORDER BY 1;

\echo '== 5. Empreinte par voyageur (vocabulaire nouveau, même données) =='
SELECT m.prenom AS voyageur,
       (SELECT count(*) FROM decision.vote_lieu    v WHERE v.membre_id = m.membre_id) AS lieux_votes,
       (SELECT count(*) FROM decision.vote_circuit v WHERE v.membre_id = m.membre_id) AS circuits_votes,
       (SELECT count(*) FROM decision.vote_variante v WHERE v.membre_id = m.membre_id) AS variantes_votees
FROM membre.membre m ORDER BY m.membre_id;

\echo '== 6. Triggers préservés (dirty + hist) sur chaque table de vote =='
SELECT event_object_table AS table_vote, trigger_name
FROM information_schema.triggers
WHERE trigger_schema = 'decision' AND event_object_table LIKE 'vote_%'
GROUP BY 1, 2 ORDER BY 1, 2;

\echo '== 7. Tiers dans l alphabet attendu T/S/A/B/C/D =='
SELECT
  (NOT EXISTS (
    SELECT 1 FROM (
      SELECT tier FROM decision.vote_lieu
      UNION ALL SELECT tier FROM decision.vote_circuit
      UNION ALL SELECT tier FROM decision.vote_variante
    ) t WHERE t.tier NOT IN ('T','S','A','B','C','D')
  )) AS tiers_dans_alphabet;

\echo '== 8. Poids vote borné [-0.3, 0.5] =='
SELECT
  (NOT EXISTS (
    SELECT 1 FROM api.base_vote_weight WHERE vote_weight < -0.3 OR vote_weight > 0.5
  )) AS poids_bornes;

\echo '=== FIN — si tous les booléens sont t et les comptages stables, le contrat voyageur_* est sain. ==='
