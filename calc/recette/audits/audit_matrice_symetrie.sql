-- audit_matrice_symetrie.sql, diagnostic rejouable de la matrice base-à-base (T006, gate C16).
-- Lecture seule. Produit les preuves de l'état AVANT recalcul et servira de contrôle APRÈS.
-- Usage : psql -h localhost -p 5433 -d norvege_routing -f calc/recette/audits/audit_matrice_symetrie.sql
-- Cible du recalcul : matrice A* complète et SYMÉTRIQUE (0 paire asymétrique), trous comblés par tunnels.

\pset pager off
\echo '== A. Volumétrie et bases =='
SELECT count(*)                          AS paires,
       count(DISTINCT src_base)          AS src_bases,
       count(*) FILTER (WHERE has_ferry) AS via_ferry,
       count(*) FILTER (WHERE traversee_insulaire) AS insulaires
FROM mcda2.base_base_routes_v2;

\echo ''
\echo '== B. Symétrie : paires présentes dans un seul sens (CIBLE APRÈS = 0) =='
SELECT count(*) AS paires_asymetriques
FROM mcda2.base_base_routes_v2 a
LEFT JOIN mcda2.base_base_routes_v2 b
  ON b.src_base = a.tgt_base AND b.tgt_base = a.src_base
WHERE b.src_base IS NULL;

\echo ''
\echo '== C. Complétude : couverture vs matrice complète (105 bases -> 10 920 paires orientées) =='
WITH bases AS (
  SELECT DISTINCT src_base AS b FROM mcda2.base_base_routes_v2
  UNION SELECT tgt_base FROM mcda2.base_base_routes_v2
)
SELECT (SELECT count(*) FROM bases)                          AS n_bases,
       (SELECT count(*) FROM bases) * ((SELECT count(*) FROM bases) - 1) AS paires_cible,
       (SELECT count(*) FROM mcda2.base_base_routes_v2)      AS paires_actuelles;

\echo ''
\echo '== D. Trous cibles des tunnels sous-marins (6<->74, 82<->77) =='
\echo '   Attendu AVANT : un seul sens present, via ferry. APRES : les deux sens, cout tunnel.'
WITH cibles(src, tgt) AS (VALUES (6,74),(74,6),(82,77),(77,82))
SELECT c.src, c.tgt,
       (r.src_base IS NOT NULL) AS presente,
       round(r.cost_s)          AS cost_s,
       r.has_ferry,
       r.traversee_insulaire
FROM cibles c
LEFT JOIN mcda2.base_base_routes_v2 r ON r.src_base = c.src AND r.tgt_base = c.tgt
ORDER BY c.src, c.tgt;

\echo ''
\echo '== E. Bases-îles de l''ouest (lon < 6), suspectes du sous-coût KNN =='
SELECT b.base_id, round(ST_X(ST_Transform(b.geom,4326))::numeric,2) AS lon,
       round(ST_Y(ST_Transform(b.geom,4326))::numeric,2) AS lat
FROM mcda2.bases_v2 b
WHERE ST_X(ST_Transform(b.geom,4326)) < 6
ORDER BY lon;

\echo ''
\echo 'Preuve du gate C16 (0 segment terrestre > 5 km hors traversee) : sur la geom figee, cote B.'
\echo 'Ici : preuve matrice = paires_asymetriques -> 0 ET les 4 lignes D presentes avec cout tunnel.'
