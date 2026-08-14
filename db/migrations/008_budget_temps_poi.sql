-- 008_budget_temps_poi.sql (A048/A054/M089 — pré-écrit ; NON exécuté ; à rejouer en DB2 au flip, règle DB2 owner-safe).
-- Pose le budget-temps POI côté DB2 : fonctions partagées `lib.*` (via le fichier canonique d'A) + table dérivée
-- `activite.poi` (peuplée par la sync B-15 depuis DB1 `diffusion.v_web_poi_activite`) + RPC `api.budget_temps_poi`.
--
-- SURFACE : DB2 (norvege_v2, Bomp4rd).
-- `lib.*` = fonctions PURES canoniques, SOURCE UNIQUE `db/lib/duree_proposee.sql` (B047 option 1) : A l'applique en DB1
--   (script 61_), moi en DB2 ici (même fichier, jamais deux copies). Schéma neutre `lib`, sans dépendance de données.
-- `activite.poi` = table DÉRIVÉE (inputs statiques par POI typés A21) : elle est un TARGET de sync (NON précieuse, PAS à
--   la denylist B-15) ; le dump DB1→DB2 la (re)remplit depuis `diffusion.v_web_poi_activite`. Colonnes = contrat A054.
--
-- MODULATION (avis agrégé × appétit groupe) = MON domaine DB2 (A054 §3). v1 ci-dessous applique une modulation NEUTRE
-- (f_avis = g_appetit = 1.0) → durée = clamp(defaut) arrondi 15 / palier. La modulation RÉELLE (008b, CREATE OR REPLACE
-- additif) est gatée par deux inconnues R1 remontées à A/M (B048) : (a) le mapping code `vote_lieu.tier` {T,D,A,C,B,S} →
-- libellé d'avis {Coup de cœur/Vraiment envie/Bien/Pourquoi pas} attendu par `lib.facteur_avis` ; (b) le stockage de
-- l'appétit thématique par voyageur en DB2 (absent aujourd'hui). Le join avis existe (poi_id→osm_id via `poi.poi`).
--
-- IDEMPOTENT : CREATE OR REPLACE / IF NOT EXISTS. Le fichier lib est inclus par \i (chemin relatif à la racine du repo
-- au flip : `psql "<dsn_db2>" -v ON_ERROR_STOP=1 -f db/migrations/008_budget_temps_poi.sql` depuis la racine).

\set ON_ERROR_STOP on
BEGIN;

-- 1. Fonctions partagées lib.* (source unique, appliquées à l'identique en DB1 par A).
\i db/lib/duree_proposee.sql

-- 2. Table dérivée : inputs statiques du budget-temps par POI (contrat A054). Peuplée par la sync B-15 (NON précieuse).
CREATE SCHEMA IF NOT EXISTS activite;
COMMENT ON SCHEMA activite IS 'A21 budget-temps : inputs statiques par POI (dérivés, synchronisés de DB1). NON précieux (target de sync).';

CREATE TABLE IF NOT EXISTS activite.poi (
  poi_id       int PRIMARY KEY,
  type_code    text,
  min_min      int,
  defaut_min   int,        -- override lieu si défini, sinon défaut du type (A054)
  max_min      int,
  granularite  text,       -- 'libre' | 'demi_journee' | 'journee'
  granularites int[],
  themes       text[],
  source       text        -- 'type' | 'lieu' (traçabilité R1)
);
COMMENT ON TABLE activite.poi IS 'A054 : inputs budget-temps par POI (sync de diffusion.v_web_poi_activite). DÉRIVÉE : re-remplie par B-15, hors précieux.';

-- 3. RPC : budget-temps résolu d'un POI. v1 modulation NEUTRE (008b ajoutera avis+appétit, additif). NULL si le POI
--    n'a pas de budget-visite (restaurant/logistique, M096) ou est inconnu → le BFF rend null (pas de budget-temps).
CREATE OR REPLACE FUNCTION api.budget_temps_poi(p_poi_id int)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=api,activite,lib,public,pg_temp AS $$
  SELECT jsonb_build_object(
    'visite', jsonb_build_object(
      'min_min', a.min_min,
      'defaut_min', a.defaut_min,
      'max_min', a.max_min,
      'pas_min', 15,
      'granularite', a.granularite,
      'granularites', a.granularites,
      'duree_retenue_min', lib.duree_proposee(a.defaut_min, a.min_min, a.max_min, a.granularite, a.granularites, 1.0, 1.0),
      'source', a.source),
    'themes', to_jsonb(coalesce(a.themes, '{}'::text[])))
  FROM activite.poi a
  WHERE a.poi_id = p_poi_id;
$$;
COMMENT ON FUNCTION api.budget_temps_poi(int) IS 'A048 : budget-temps résolu d''un POI { visite, themes } (NULL si sans budget-visite). v1 modulation neutre ; 008b ajoutera avis+appétit.';
GRANT EXECUTE ON FUNCTION api.budget_temps_poi(int) TO web_anon;

COMMIT;

-- ============================================================================
-- REQUÊTES D'ACCEPTATION (à jouer par B en DB2 après application au flip + sync B-15 de activite.poi ; R1) :
-- a) fonctions lib présentes      : SELECT lib.facteur_avis('Coup de cœur'), lib.facteur_appetit(1.0), lib.duree_proposee(20,15,60,'libre',NULL,1.0,1.0); -- 1.30 | 1.5 | 15/20
-- b) table dérivée peuplée         : SELECT count(*) FROM activite.poi;                       -- ~1276 (1635 typés - 359 sans budget)
-- c) POI avec budget               : SELECT api.budget_temps_poi((SELECT poi_id FROM activite.poi LIMIT 1)); -- { visite:{...}, themes:[...] }
-- d) POI sans budget / inconnu     : SELECT api.budget_temps_poi(-1);                          -- (null)
-- e) grant                         : SELECT has_function_privilege('web_anon','api.budget_temps_poi(int)','EXECUTE'); -- t
-- ============================================================================
