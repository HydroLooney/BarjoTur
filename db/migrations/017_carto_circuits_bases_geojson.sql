-- 017_carto_circuits_bases_geojson.sql (M410/C139) — RPC GeoJSON des 2 DERNIÈRES couches carto (circuits + bases idéales),
-- pour que C retire ses derniers statiques. Même patron GÉNÉRIQUE que 015 (ST_AsGeoJSON(geom) + to_jsonb(vue)-'geom' →
-- toutes les colonnes de la vue en properties), LECTURE seule, SECURITY DEFINER, web_anon.
--
-- GATE : lisent diffusion.v_web_circuits et diffusion.v_web_bases_ideales — livrées par A au DUMP FINAL (bases RÉ-OPTIMISÉES
-- + circuits, cf A134). Tant qu'elles n'existent pas, la RPC est absente (42883) → le BFF (services/carto.ts) dégrade en
-- FeatureCollection VIDE (siRpcAbsente) : le client garde le contrat de prod, zéro re-câblage au flip. Idempotent. Rollback = DROP.
--
-- SURFACE : DB2 (norvege_v2). Additif (2 fonctions). Non précieux. Appliqué au flip (lot 012-017).
-- Usage (flip) : cat db/migrations/017_*.sql | ssh bomp4rd "docker exec -i norvege-db psql -U norvege -d norvege_v2 -v ON_ERROR_STOP=1"

\set ON_ERROR_STOP on
BEGIN;

-- Circuits (v_web_circuits : circuit_id, nom, distance_km, denivele_pos, tier_defaut, votable, geom LineString).
CREATE OR REPLACE FUNCTION api.carto_circuits_geojson()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=api,diffusion,public,pg_temp AS $$
  SELECT jsonb_build_object('type','FeatureCollection','features', COALESCE(jsonb_agg(jsonb_build_object(
    'type','Feature', 'geometry', ST_AsGeoJSON(geom)::jsonb, 'properties', to_jsonb(c) - 'geom')),'[]'::jsonb))
  FROM diffusion.v_web_circuits c;
$$;
GRANT EXECUTE ON FUNCTION api.carto_circuits_geojson() TO web_anon;

-- Bases idéales (v_web_bases_ideales : base_id, nom, tier_moyen, nuits_max_faisable, geom Point — ré-optimisées au final).
CREATE OR REPLACE FUNCTION api.carto_bases_geojson()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=api,diffusion,public,pg_temp AS $$
  SELECT jsonb_build_object('type','FeatureCollection','features', COALESCE(jsonb_agg(jsonb_build_object(
    'type','Feature', 'geometry', ST_AsGeoJSON(geom)::jsonb, 'properties', to_jsonb(b) - 'geom')),'[]'::jsonb))
  FROM diffusion.v_web_bases_ideales b;
$$;
GRANT EXECUTE ON FUNCTION api.carto_bases_geojson() TO web_anon;

COMMIT;

-- ACCEPTATION (après application, vues d'A présentes) : SELECT api.carto_circuits_geojson()->>'type'; -- 'FeatureCollection'
-- Rollback : DROP FUNCTION api.carto_circuits_geojson(), api.carto_bases_geojson().
