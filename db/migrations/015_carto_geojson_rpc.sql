-- 015_carto_geojson_rpc.sql (M367) — RPC GeoJSON des couches carto, servies depuis les vues diffusion (plus de statique).
-- Chaque RPC rend une FeatureCollection GeoJSON (ST_AsGeoJSON de geom + propriétés v3). LECTURE seule, SECURITY DEFINER,
-- web_anon. GATE : lisent `diffusion.v_web_*` (livrées par A en Passe 2, colonnes v3) → NON appliquée avant que les vues
-- existent + « go bascule ». D'ici là le BFF dégrade en FC vide (services/carto.ts). Idempotent. Rollback = DROP.

\set ON_ERROR_STOP on
BEGIN;

-- POI (v_web_poi v3 : tier, confiance, votable, categorie_calque, sous_zone_id, nom_affichage, type_entite…).
CREATE OR REPLACE FUNCTION api.carto_poi_geojson()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=api,diffusion,public,pg_temp AS $$
  SELECT jsonb_build_object('type','FeatureCollection','features', COALESCE(jsonb_agg(jsonb_build_object(
    'type','Feature', 'geometry', ST_AsGeoJSON(geom)::jsonb,
    'properties', to_jsonb(p) - 'geom')),'[]'::jsonb))
  FROM diffusion.v_web_poi p;
$$;
GRANT EXECUTE ON FUNCTION api.carto_poi_geojson() TO web_anon;

-- Découpage (v_web_decoupage : niveau, id, parent_id, n_poi, couverte_par…).
CREATE OR REPLACE FUNCTION api.carto_decoupage_geojson()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=api,diffusion,public,pg_temp AS $$
  SELECT jsonb_build_object('type','FeatureCollection','features', COALESCE(jsonb_agg(jsonb_build_object(
    'type','Feature', 'geometry', ST_AsGeoJSON(geom)::jsonb, 'properties', to_jsonb(d) - 'geom')),'[]'::jsonb))
  FROM diffusion.v_web_decoupage d;
$$;
GRANT EXECUTE ON FUNCTION api.carto_decoupage_geojson() TO web_anon;

-- Services van (aires/bobil/laverie/élec — v_web_poi_services_van, chantier aménités M263/M342).
CREATE OR REPLACE FUNCTION api.carto_services_van_geojson()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=api,diffusion,public,pg_temp AS $$
  SELECT jsonb_build_object('type','FeatureCollection','features', COALESCE(jsonb_agg(jsonb_build_object(
    'type','Feature', 'geometry', ST_AsGeoJSON(geom)::jsonb, 'properties', to_jsonb(s) - 'geom')),'[]'::jsonb))
  FROM diffusion.v_web_poi_services_van s;
$$;
GRANT EXECUTE ON FUNCTION api.carto_services_van_geojson() TO web_anon;

-- Routes scéniques (v_web_routes_sceniques, M311/M312).
CREATE OR REPLACE FUNCTION api.carto_routes_sceniques_geojson()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=api,diffusion,public,pg_temp AS $$
  SELECT jsonb_build_object('type','FeatureCollection','features', COALESCE(jsonb_agg(jsonb_build_object(
    'type','Feature', 'geometry', ST_AsGeoJSON(geom)::jsonb, 'properties', to_jsonb(r) - 'geom')),'[]'::jsonb))
  FROM diffusion.v_web_routes_sceniques r;
$$;
GRANT EXECUTE ON FUNCTION api.carto_routes_sceniques_geojson() TO web_anon;

-- Sentiers (v_web_sentiers : difficulte, surface, saison, length_m — T048/A060).
CREATE OR REPLACE FUNCTION api.carto_sentiers_geojson()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=api,diffusion,public,pg_temp AS $$
  SELECT jsonb_build_object('type','FeatureCollection','features', COALESCE(jsonb_agg(jsonb_build_object(
    'type','Feature', 'geometry', ST_AsGeoJSON(geom)::jsonb, 'properties', to_jsonb(s) - 'geom')),'[]'::jsonb))
  FROM diffusion.v_web_sentiers s;
$$;
GRANT EXECUTE ON FUNCTION api.carto_sentiers_geojson() TO web_anon;

COMMIT;

-- ACCEPTATION (après application, vues d'A présentes) : SELECT api.carto_poi_geojson()->>'type'; -- 'FeatureCollection'
-- NB : `to_jsonb(p) - 'geom'` expose TOUTES les colonnes de la vue en properties → le schéma exact suit la vue d'A.
--     Si une couche est volumineuse (POI 1994, sentiers 139k), prévoir une simplification/allègement côté vue (A) ou une
--     pagination bbox (comme api.poi_in_bbox) — à arbitrer selon le poids réel. Rollback = DROP des 5 fonctions.
