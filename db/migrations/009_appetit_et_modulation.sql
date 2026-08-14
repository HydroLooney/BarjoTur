-- 009_appetit_et_modulation.sql (M097, A054/A21 — pré-écrit ; NON exécuté ; à rejouer en DB2 au flip, owner-safe).
-- Débloque la MODULATION réelle du budget-temps (avis agrégé × appétit thématique) tranchée par M097 :
--   1. table PRÉCIEUSE `decision.appetit_thematique` (état vif du voyageur : envie par thème) + RPC lire/écrire.
--   2. CREATE OR REPLACE `api.budget_temps_poi` = 008b : modulation réelle (008 posait la v1 neutre).
--
-- SURFACE : DB2 (norvege_v2, serveur de déploiement).
-- `decision.appetit_thematique` est PRÉCIEUSE (préférence vivante, comme votes/decision) : DÉJÀ couverte par la denylist
--   de sync B-15 (`decision.*` est précieux, regex 003 + backup) — rien à ajouter, le dump DB1→DB2 ne la touche jamais.
-- Modulation (M097) : facteur avis PAR CODE via `lib.facteur_avis(tier)` (T1,30 S1,18 A1,08 B1,00 C0,90 D0,80, posé par A
--   dans db/lib) ; join avis poi_id→osm_id via `poi.poi` → `decision.vote_lieu` ; appétit groupe = agrégat ÉGALITARISTE
--   (1 voix/membre : moyenne, par membre, de son appétit sur les thèmes du POI ; puis moyenne sur les membres) → neutre
--   si aucune donnée. Traçabilité R1 : `source='preference'` dès qu'un facteur ≠ 1, sinon le statique ('type'|'lieu').
--
-- IDEMPOTENT : \i (lib idempotent), IF NOT EXISTS, CREATE OR REPLACE. Rollback = DROP.
-- Usage (DB2, au flip, depuis la racine) : psql "<dsn_db2>" -v ON_ERROR_STOP=1 -f db/migrations/009_appetit_et_modulation.sql

\set ON_ERROR_STOP on
BEGIN;

-- Assure les fonctions partagées (idempotent ; 008 les a déjà appliquées, on ne dépend pas de l'ordre).
\i db/lib/duree_proposee.sql

-- 1. Table précieuse : appétit thématique par voyageur (envie par thème, [0..1]).
CREATE TABLE IF NOT EXISTS decision.appetit_thematique (
  membre_id bigint NOT NULL,
  theme     text   NOT NULL,
  appetit   numeric NOT NULL CHECK (appetit >= 0 AND appetit <= 1),
  maj_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (membre_id, theme)
);
COMMENT ON TABLE decision.appetit_thematique IS 'M097 : appétit thématique par voyageur (feature C M092). PRÉCIEUSE : hors sync B-15 (decision.*). Agrégée égalitariste pour moduler le budget-temps.';

-- Lecture : les appétits du membre porteur du lien (ouverte au lien ; le BFF gate la capacité voter).
CREATE OR REPLACE FUNCTION api.appetit_lire(p_code text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=api,decision,membre,public,pg_temp AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('theme', at.theme, 'appetit', at.appetit) ORDER BY at.theme), '[]'::jsonb)
  FROM decision.appetit_thematique at
  JOIN membre.membre m ON m.membre_id = at.membre_id
  WHERE m.code_lien = p_code AND m.actif;
$$;
COMMENT ON FUNCTION api.appetit_lire(text) IS 'M097 : appétits thématiques du membre porteur du lien (liste {theme,appetit}). Lecture ouverte au lien.';
GRANT EXECUTE ON FUNCTION api.appetit_lire(text) TO web_anon;

-- Écriture : upsert d'un appétit (le BFF gate la capacité voter en amont). Résout le membre par son lien. Clamp [0,1].
CREATE OR REPLACE FUNCTION api.appetit_ecrire(p_code text, p_theme text, p_appetit numeric)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=api,decision,membre,public,pg_temp AS $$
DECLARE v_membre bigint; v_val numeric;
BEGIN
  SELECT membre_id INTO v_membre FROM membre.membre WHERE code_lien = p_code AND actif;
  IF v_membre IS NULL THEN RETURN jsonb_build_object('ok',false,'error','membre inconnu'); END IF;
  IF p_theme IS NULL OR btrim(p_theme) = '' THEN RETURN jsonb_build_object('ok',false,'error','thème requis'); END IF;
  v_val := least(1, greatest(0, coalesce(p_appetit,0)));
  INSERT INTO decision.appetit_thematique (membre_id, theme, appetit, maj_at)
  VALUES (v_membre, p_theme, v_val, now())
  ON CONFLICT (membre_id, theme) DO UPDATE SET appetit = EXCLUDED.appetit, maj_at = now();
  RETURN jsonb_build_object('ok',true,'theme',p_theme,'appetit',v_val);
END $$;
COMMENT ON FUNCTION api.appetit_ecrire(text,text,numeric) IS 'M097 : upsert de l''appétit thématique du membre (clamp [0,1]). Le BFF gate la capacité voter. {ok:false} si membre/thème invalide.';
GRANT EXECUTE ON FUNCTION api.appetit_ecrire(text,text,numeric) TO web_anon;

-- 2. 008b : budget-temps POI avec MODULATION RÉELLE (remplace la v1 neutre de 008).
CREATE OR REPLACE FUNCTION api.budget_temps_poi(p_poi_id int)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=api,activite,decision,poi,lib,public,pg_temp AS $$
  WITH a AS (SELECT * FROM activite.poi WHERE poi_id = p_poi_id),
  -- avis agrégé égalitariste : moyenne de lib.facteur_avis(code) sur les membres ayant classé ce POI (join osm_id).
  av AS (
    SELECT COALESCE(avg(lib.facteur_avis(vl.tier)), 1.0) AS f_avis
    FROM a
    JOIN poi.poi p ON p.poi_id = a.poi_id
    JOIN decision.vote_lieu vl ON vl.poi_osm_id = p.osm_id
  ),
  -- appétit groupe égalitariste : par membre, moyenne de son appétit sur les thèmes du POI ; puis moyenne sur les membres.
  ap AS (
    SELECT lib.facteur_appetit(COALESCE(avg(pm.app), 0)) AS g_appetit
    FROM (
      SELECT at.membre_id, avg(at.appetit) AS app
      FROM a, decision.appetit_thematique at
      WHERE at.theme = ANY(a.themes)
      GROUP BY at.membre_id
    ) pm
  )
  SELECT jsonb_build_object(
    'visite', jsonb_build_object(
      'min_min', a.min_min,
      'defaut_min', a.defaut_min,
      'max_min', a.max_min,
      'pas_min', 15,
      'granularite', a.granularite,
      'granularites', a.granularites,
      'duree_retenue_min', lib.duree_proposee(a.defaut_min, a.min_min, a.max_min, a.granularite, a.granularites, av.f_avis, ap.g_appetit),
      'source', CASE WHEN av.f_avis <> 1.0 OR ap.g_appetit <> 1.0 THEN 'preference' ELSE a.source END),
    'themes', to_jsonb(COALESCE(a.themes, '{}'::text[])))
  FROM a, av, ap;
$$;
COMMENT ON FUNCTION api.budget_temps_poi(int) IS 'M097/008b : budget-temps POI { visite, themes } avec modulation réelle (avis vote_lieu × appétit decision.appetit_thematique, égalitariste). NULL si POI sans budget/inconnu.';
GRANT EXECUTE ON FUNCTION api.budget_temps_poi(int) TO web_anon;

COMMIT;

-- ============================================================================
-- ACCEPTATION (au flip + sync activite.poi ; R1) :
-- a) écrire un appétit          : SELECT api.appetit_ecrire((SELECT code_lien FROM membre.membre WHERE actif LIMIT 1),'nautique',0.9);
-- b) relire                     : SELECT api.appetit_lire((SELECT code_lien FROM membre.membre WHERE actif LIMIT 1)); -- [{theme:nautique,appetit:0.9}]
-- c) POI modulé (avec votes/appétit) : SELECT api.budget_temps_poi((SELECT poi_id FROM activite.poi LIMIT 1)); -- source 'preference' si modulé
-- d) POI sans donnée -> neutre  : (durée = clamp(defaut), source 'type'|'lieu')
-- e) grants                     : SELECT has_function_privilege('web_anon','api.appetit_ecrire(text,text,numeric)','EXECUTE'); -- t (x3)
-- NB : nettoyer les lignes de test (DELETE FROM decision.appetit_thematique WHERE theme='nautique' AND appetit=0.9) si non réelles.
-- ============================================================================
