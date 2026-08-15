-- 018_poi_detail_fiche.sql (M405/A140) — RPC détail POI pour la fiche (GET /api/poi/:cle, chargée en lazy par C).
-- api.poi_detail(cle) rend le détail depuis poi.poi (presentation, description, acces_van, fenetre_calme, temps_visite,
-- tier_defaut, payant/tarif/reservation, saison, parking, tags, url, liens_officiels, page_guide…). Résolution de la clé :
-- osm_id (OSM entier / synthétique bt:…) OU `poi:<poi_id>` (les 3 POI osm-less, sentinelle osm_id NULL/'-1', A140).
--
-- Les PHOTOS ne passent PAS par cette RPC : elles viennent du manifeste (data/echantillon-web, dev) puis de la RPC
-- api.poi_photos (vue diffusion.v_web_poi_photos livrée par A au DUMP FINAL). Le BFF (services/poi.ts lirePoiFiche) tente
-- poi_photos, dégrade sur le manifeste, sinon []. poi_photos N'EST PAS créée ici (sa vue n'existe pas encore → 42883, le
-- BFF bascule sur le manifeste) ; elle arrivera avec la vue.
--
-- SURFACE : DB2 (norvege_v2). Additif (1 fonction). LECTURE seule, SECURITY DEFINER, web_anon. Non précieux. IDEMPOTENT.
-- GATE : appliqué au FLIP (lot 012-018). VÉRIFIÉ en DRY-RUN (BEGIN…ROLLBACK) sur la vraie DB2 (0 committé). Rollback = DROP.
-- Usage (flip) : cat db/migrations/018_*.sql | ssh bomp4rd "docker exec -i norvege-db psql -U norvege -d norvege_v2 -v ON_ERROR_STOP=1"

\set ON_ERROR_STOP on
BEGIN;

CREATE OR REPLACE FUNCTION api.poi_detail(cle text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=api,poi,public,pg_temp AS $$
  SELECT (to_jsonb(p) - 'geom' - 'trace_eau')
         || jsonb_build_object(
              'cle', CASE WHEN p.osm_id IS NULL OR p.osm_id IN ('', '-1') THEN 'poi:'||p.poi_id ELSE p.osm_id END,
              'osm_id_valide', (p.osm_id IS NOT NULL AND p.osm_id NOT IN ('', '-1')))
  FROM poi.poi p
  WHERE p.osm_id = cle
     OR (cle LIKE 'poi:%' AND p.poi_id = NULLIF(regexp_replace(cle, '^poi:', ''), '')::bigint)
  ORDER BY (p.osm_id = cle) DESC NULLS LAST   -- match osm_id exact prioritaire
  LIMIT 1;
$$;
COMMENT ON FUNCTION api.poi_detail(text) IS 'M405/018 : détail POI pour la fiche (poi.poi sans geom/trace_eau + cle + osm_id_valide). Clé = osm_id ou poi:<poi_id>. NULL si POI inconnu. Photos = api.poi_photos / manifeste (hors de cette RPC).';
GRANT EXECUTE ON FUNCTION api.poi_detail(text) TO web_anon;

COMMIT;

-- ACCEPTATION (dry-run BEGIN…ROLLBACK sur DB2, 0 committé) :
--   a) par osm_id  : SELECT api.poi_detail((SELECT osm_id FROM poi.poi WHERE osm_id ~ '^-?[0-9]+$' LIMIT 1))->>'nom';  -- non nul
--   b) par poi:<id>: SELECT api.poi_detail('poi:'||(SELECT poi_id FROM poi.poi LIMIT 1))->>'cle';                      -- 'poi:<id>'
--   c) pas de geom : SELECT api.poi_detail((SELECT osm_id FROM poi.poi WHERE osm_id ~ '^-?[0-9]+$' LIMIT 1)) ? 'geom'; -- false
--   d) inconnu     : SELECT api.poi_detail('poi:0') IS NULL;                                                            -- true
-- Rollback : DROP FUNCTION api.poi_detail(text).
