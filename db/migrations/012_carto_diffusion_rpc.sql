-- 012_carto_diffusion_rpc.sql (M272 §3 — wrappers api.* des vues de diffusion carto, contrat B088/M263).
-- Le BFF est RPC-only : ces fonctions exposent en JSON les MÉTADONNÉES carto que C lit par-dessus les tuiles Martin
-- (Martin, lui, lit les vues de diffusion en direct pour la géométrie). LECTURE seule, SECURITY DEFINER, web_anon.
--
-- GATE : ces RPC LISENT `diffusion.v_web_poi.categorie_calque` et `diffusion.v_web_decoupage`. Ces vues/colonnes
-- n'existent PAS encore en DB2 (livrées par A en Passe 2, dump final). NE PAS appliquer cette migration avant que les
-- vues existent (sinon les fonctions compilent mais échouent à l'appel). Tant qu'elles ne sont pas posées, le BFF
-- dégrade proprement (services/carto.ts : RPC absente 42883 → 200 vide). Application = accord DIRECT de Guillaume,
-- APRÈS le dump final. Idempotent (CREATE OR REPLACE). Rollback = DROP des deux fonctions.
--
-- Usage (DB2, après feu) : cat db/migrations/012_*.sql | ssh bomp4rd "docker exec -i norvege-db psql -U norvege -d norvege_v2 -v ON_ERROR_STOP=1"

\set ON_ERROR_STOP on
BEGIN;

-- Légende / filtre des calques : les buckets categorie_calque (17-18 A079 + « services_van ») et leurs effectifs.
CREATE OR REPLACE FUNCTION api.carto_calques()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=api,diffusion,public,pg_temp AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('categorie_calque', categorie_calque, 'n', n) ORDER BY n DESC), '[]'::jsonb)
  FROM (
    SELECT categorie_calque, count(*) AS n
    FROM diffusion.v_web_poi
    WHERE categorie_calque IS NOT NULL
    GROUP BY categorie_calque
  ) x;
$$;
COMMENT ON FUNCTION api.carto_calques() IS 'M272/B088 : légende carto = buckets categorie_calque + effectifs (filtre par catégorie de C).';
GRANT EXECUTE ON FUNCTION api.carto_calques() TO web_anon;

-- Hiérarchie de découpage (emboîtement réel), filtrable par niveau ; sans géométrie (Martin sert la géométrie).
CREATE OR REPLACE FUNCTION api.carto_decoupage(p_niveau text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=api,diffusion,public,pg_temp AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('niveau', niveau, 'id', id, 'parent_id', parent_id, 'n_poi', n_poi)
                            ORDER BY niveau, id), '[]'::jsonb)
  FROM diffusion.v_web_decoupage
  WHERE p_niveau IS NULL OR niveau = p_niveau;
$$;
COMMENT ON FUNCTION api.carto_decoupage(text) IS 'M272/B088 : hiérarchie de découpage niveau/id/parent_id/n_poi (métadonnées, géométrie via Martin).';
GRANT EXECUTE ON FUNCTION api.carto_decoupage(text) TO web_anon;

-- Légende sentiers : buckets de difficulté + effectifs (facile|moyen|difficile|expert|non_grade).
CREATE OR REPLACE FUNCTION api.carto_sentiers_difficultes()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=api,diffusion,public,pg_temp AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('difficulte', difficulte, 'n', n) ORDER BY n DESC), '[]'::jsonb)
  FROM (SELECT COALESCE(difficulte,'non_grade') AS difficulte, count(*) AS n FROM diffusion.v_web_sentiers GROUP BY 1) x;
$$;
COMMENT ON FUNCTION api.carto_sentiers_difficultes() IS 'M315/B088 : légende sentiers = buckets de difficulté + effectifs.';
GRANT EXECUTE ON FUNCTION api.carto_sentiers_difficultes() TO web_anon;

-- Circuits carto (métadonnées ; géométrie via Martin).
CREATE OR REPLACE FUNCTION api.carto_circuits()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=api,diffusion,public,pg_temp AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('circuit_id', circuit_id, 'nom', nom, 'distance_km', distance_km,
           'denivele_pos', denivele_pos, 'tier_defaut', tier_defaut, 'votable', votable) ORDER BY nom), '[]'::jsonb)
  FROM diffusion.v_web_circuits;
$$;
COMMENT ON FUNCTION api.carto_circuits() IS 'M315/B088 : circuits carto (métadonnées).';
GRANT EXECUTE ON FUNCTION api.carto_circuits() TO web_anon;

-- Bases carto (points de nuit ; géométrie via Martin).
CREATE OR REPLACE FUNCTION api.carto_bases()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=api,diffusion,public,pg_temp AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('base_id', base_id, 'nom', nom, 'tier_moyen', tier_moyen,
           'nuits_max_faisable', nuits_max_faisable) ORDER BY nom), '[]'::jsonb)
  FROM diffusion.v_web_bases;
$$;
COMMENT ON FUNCTION api.carto_bases() IS 'M315/B088 : bases carto (points de nuit, métadonnées).';
GRANT EXECUTE ON FUNCTION api.carto_bases() TO web_anon;

COMMIT;

-- ============================================================================
-- ACCEPTATION (après application, vues d'A présentes) :
--   SELECT api.carto_calques();                    -- [{categorie_calque, n}, ...]
--   SELECT api.carto_decoupage('region');          -- [{niveau:region, id, parent_id, n_poi}, ...]
--   server/recette (smoke) : /api/carto/calques et /api/carto/decoupage rendent 200 non vide.
-- Rollback : DROP FUNCTION api.carto_calques(); DROP FUNCTION api.carto_decoupage(text);
-- ============================================================================
