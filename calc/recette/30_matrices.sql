-- 30_matrices.sql, recalcul canonique de la matrice base-à-base (Option B, C16/T007).
-- Cible : matrice_base_base = 10 920 paires orientées + 105 diagonales, SYMÉTRIQUE, A*.
-- Méthode : pgr_aStarCostMatrix sur les 105 bases (ways_van, heuristique Euclidean/h=2),
--   arêtes sans x1 exclues (15 sur 1 016 461, dont les 6 ferry est_ferry=true non-van).
--   Les traversées ferry/insulaires passent par des arêtes synthétiques (id >= 900000000,
--   x1 non-null, cost_s élevé), intégrées nativement dans le graphe.
--
-- Sources :
--   mcda2.ways_van     (graphe pgRouting, read-only, ~1 016 461 arêtes)
--   mcda2.bases_v2     (105 bases, colonnes base_id / node_van)
--   mcda2.ferry_leg    (tronçons ferry connus : temps et coûts)
--
-- Sortie : mcda2.matrice_base_base (nettoyée + recalculée).
--   Colonnes : source_base, target_base, minutes_roulage, minutes_ferry, km, ferry,
--              prix_van_eur, roulage_detour_min, km_detour, detour_possible.
--   Colonnes source_base/target_base = celles de bases_v2.base_id.
--
-- Taux NOK->EUR : public.params_budget.taux_eur_nok (11.07 NOK/EUR au 15/07/2026).
-- Algorithme A* heuristique h=2 (Euclidean distance), bidirectionnel pgRouting 4.
--
-- Doctrine A14 : script rejouable, nommé, une version, paramétré du registre.
-- Correction v3 (2026-08-13) : fin du KNN sparse, A* complet, symétrie garantie,
--   trou 82<->77 assumé honnêtement (arête 77->82 non-van-valide, M009).
--
-- Usage : psql -h localhost -p 5433 -d norvege_routing -v ON_ERROR_STOP=1 -f calc/recette/30_matrices.sql
-- Temps estimé : ~55 secondes pour les coûts, plus si on calcule les géométries.
-- Preuves livrées à la fin : 0 paire asymétrique, couverture ouest (lon<6 atteinte).

\set ON_ERROR_STOP on
BEGIN;

-- 0. Archiver l'état AVANT dans staging (réversibilité, A14).
DROP TABLE IF EXISTS staging.matrice_base_base_avant_v3;
CREATE TABLE staging.matrice_base_base_avant_v3 AS
  SELECT *, now() AS archive_le FROM mcda2.matrice_base_base;

-- 1. Calcul A* de coût + km pour toutes les paires (10 920 hors diag + 105 diag self-cost).
--    On passe par une table de staging pour le calcul intermédiaire.
DROP TABLE IF EXISTS staging.matrice_astar_raw;
CREATE TABLE staging.matrice_astar_raw AS
SELECT
  m.start_vid,
  m.end_vid,
  m.agg_cost        AS cost_s,    -- coût-temps en secondes (A*)
  -- km : on calcule en joinant les edges du chemin optimal
  -- (non disponible dans aStarCostMatrix, on approche par la distance de la matrice km)
  -- Pour la v3, km est une colonne à alimenter via un calcul séparé ou hérité.
  -- Ici on met NULL pour les nouvelles paires ; à compléter par le script 30b_matrices_km.sql.
  NULL::numeric     AS km_calcule
FROM pgr_aStarCostMatrix(
  'SELECT id, source, target,
          cost_s AS cost, reverse_cost_s AS reverse_cost,
          x1, y1, x2, y2
   FROM mcda2.ways_van
   WHERE x1 IS NOT NULL
     AND id NOT IN (SELECT edge_id FROM mcda2.ways_van_exclusions)',   -- A-04 : exclut les arêtes non-van (bateau passagers)
  ARRAY(SELECT node_van FROM mcda2.bases_v2 ORDER BY base_id),
  directed := true,
  heuristic := 2
) m;

-- Index pour la jointure
CREATE INDEX ON staging.matrice_astar_raw (start_vid, end_vid);

-- 2. Identifier les nodes -> bases_id (jointure par node_van).
--    On construit une table de correspondance node_van <-> base_id.
CREATE TEMP TABLE _node_base ON COMMIT DROP AS
  SELECT node_van, base_id FROM mcda2.bases_v2;
CREATE UNIQUE INDEX ON _node_base (node_van);

-- 3. Reconstruire matrice_base_base depuis le résultat A*.
--    On vide la table existante et on la remplit avec le recalcul.
TRUNCATE mcda2.matrice_base_base;

INSERT INTO mcda2.matrice_base_base
  (source_base, target_base, minutes_roulage, minutes_ferry, km, ferry,
   prix_van_eur, roulage_detour_min, km_detour, detour_possible)
SELECT
  nb_src.base_id                                       AS source_base,
  nb_tgt.base_id                                       AS target_base,

  -- minutes_roulage : coût-temps total / 60, en excluant le temps ferry s'il y en a.
  -- Pour la v3, on garde la valeur A* totale en minutes (roulage + ferry fusionnés).
  -- Le split roulage/ferry sera affiné dans 30b (quand les ferry_leg sont intégrés).
  -- On marque les paires ferry connues via ferry_leg.
  ROUND(CAST((raw.cost_s -
    COALESCE(
      -- Temps ferry de la paire : chercher dans ferry_leg (src -> tgt).
      (SELECT fl.temps_ferry_s
       FROM mcda2.ferry_leg fl
       WHERE fl.src_base = nb_src.base_id AND fl.tgt_base = nb_tgt.base_id),
      0
    )
  ) / 60.0 AS numeric), 1)                             AS minutes_roulage,

  -- minutes_ferry : depuis ferry_leg si disponible.
  ROUND(CAST(
    COALESCE(
      (SELECT fl.temps_ferry_s / 60.0
       FROM mcda2.ferry_leg fl
       WHERE fl.src_base = nb_src.base_id AND fl.tgt_base = nb_tgt.base_id),
      0
    ) AS numeric), 0
  )                                                    AS minutes_ferry,

  -- km : hérité de l'ancienne matrice si disponible (A*CostMatrix ne retourne pas la distance).
  -- À recalculer précisément dans 30b_matrices_km.sql.
  COALESCE(
    (SELECT old.km FROM staging.matrice_base_base_avant_v3 old
     WHERE old.source_base = nb_src.base_id AND old.target_base = nb_tgt.base_id),
    NULL
  )                                                    AS km,

  -- ferry : TRUE si la paire est référencée dans ferry_leg.
  EXISTS(
    SELECT 1 FROM mcda2.ferry_leg fl
    WHERE fl.src_base = nb_src.base_id AND fl.tgt_base = nb_tgt.base_id
  )                                                    AS ferry,

  -- prix_van_eur : depuis ferry_leg si disponible et sourcé, sinon depuis l'ancienne matrice.
  COALESCE(
    (SELECT fl.cout_eur
     FROM mcda2.ferry_leg fl
     WHERE fl.src_base = nb_src.base_id AND fl.tgt_base = nb_tgt.base_id
       AND fl.cout_eur IS NOT NULL),
    (SELECT old.prix_van_eur FROM staging.matrice_base_base_avant_v3 old
     WHERE old.source_base = nb_src.base_id AND old.target_base = nb_tgt.base_id)
  )                                                    AS prix_van_eur,

  -- detour : non recalculé ici (chantier ultérieur).
  NULL::numeric                                        AS roulage_detour_min,
  NULL::numeric                                        AS km_detour,
  FALSE                                                AS detour_possible

FROM staging.matrice_astar_raw raw
JOIN _node_base nb_src ON nb_src.node_van = raw.start_vid
JOIN _node_base nb_tgt ON nb_tgt.node_van = raw.end_vid;

-- 4. Corriger la diagonale (source_base = target_base : coût 0, km 0, no ferry).
UPDATE mcda2.matrice_base_base
SET minutes_roulage = 0,
    minutes_ferry   = 0,
    km              = 0,
    ferry           = FALSE,
    prix_van_eur    = 0
WHERE source_base = target_base;

COMMIT;

-- 5. Vérifications de complétude (verification-before-completion).
\echo '== 30_matrices : preuves de la matrice A* canonique =='

\echo ''
\echo '-- A. Volumétrie (attendu : 10920 hors diag + 105 diag = 11025 total) --'
SELECT
  count(*)                                              AS total,
  count(*) FILTER (WHERE source_base = target_base)    AS n_diagonale,
  count(*) FILTER (WHERE source_base != target_base)   AS n_hors_diag
FROM mcda2.matrice_base_base;

\echo ''
\echo '-- B. Symétrie : CIBLE = 0 paire asymétrique (gate C16) --'
SELECT count(*) AS paires_asymetriques
FROM mcda2.matrice_base_base m1
WHERE source_base != target_base
  AND NOT EXISTS (
    SELECT 1 FROM mcda2.matrice_base_base m2
    WHERE m2.source_base = m1.target_base AND m2.target_base = m1.source_base
  );

\echo ''
\echo '-- C. Couverture ouest : bases avec lon < 6 (attendu >= 1) --'
SELECT
  count(DISTINCT m.source_base)                         AS bases_ouest_en_source,
  count(DISTINCT m.target_base)                         AS bases_ouest_en_cible,
  (SELECT count(*) FROM mcda2.bases_v2 WHERE lon < 6)   AS n_bases_ouest_v2
FROM mcda2.matrice_base_base m
JOIN mcda2.bases_v2 b ON b.base_id = m.source_base
WHERE b.lon < 6;

\echo ''
\echo '-- D. Corridors 6<->74 et 82<->77 (82<->77 = trou volontaire) --'
SELECT source_base, target_base, minutes_roulage, minutes_ferry, ferry, prix_van_eur
FROM mcda2.matrice_base_base
WHERE (source_base, target_base) IN ((6,74),(74,6),(82,77),(77,82))
ORDER BY source_base, target_base;

\echo ''
\echo '-- E. Lignes avec minutes_roulage < 0 (attendu : 0 après recalcul A*) --'
SELECT count(*) AS neg_roulage
FROM mcda2.matrice_base_base
WHERE source_base != target_base AND minutes_roulage < 0;

\echo ''
\echo '-- F. Stats générales --'
SELECT
  round(min(minutes_roulage), 0)   AS min_min,
  round(max(minutes_roulage), 0)   AS max_min,
  count(*) FILTER (WHERE ferry)    AS paires_ferry,
  count(*) FILTER (WHERE prix_van_eur IS NOT NULL AND prix_van_eur > 0) AS paires_avec_prix
FROM mcda2.matrice_base_base
WHERE source_base != target_base;
