-- 001_fix_api_poi_propositions_geomtype.sql (tâche loop A-18, bug B016)
-- Bug DB2 (R1) : api.poi_propositions faisait ST_X(p.geom)/ST_Y(p.geom) sur des propositions incluant des
-- circuits rando en LINESTRING/MULTILINESTRING (arbitrage #8 : circuit visible au vote) → ERROR « Argument to
-- ST_X() must have type POINT » → 500 sur GET /api/carnet/:code/propositions.
--
-- Correctif : point REPRÉSENTATIF valable pour tout type via ST_PointOnSurface (garanti SUR la géométrie,
-- contrairement au centroïde qui peut tomber hors d'une ligne courbe). Ajout ADDITIF d'un champ `geom_type`
-- pour que le front sache rendre un circuit (ligne) vs un POI (point). NULL-safe.
--
-- Idempotent (CREATE OR REPLACE). À appliquer sur DB2 (surface servie). Le Maître câble à la bascule.
-- Usage (DB2) : psql "<dsn_db2>" -f db/migrations/001_fix_api_poi_propositions_geomtype.sql

CREATE OR REPLACE FUNCTION api.poi_propositions(code text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=api,poi,membre,public,pg_temp AS $$
DECLARE is_owner boolean;
BEGIN
  SELECT (role='owner') INTO is_owner FROM membre.membre WHERE code_lien=code AND actif;
  IF NOT COALESCE(is_owner,false) THEN RETURN jsonb_build_object('ok',false,'error','réservé owner'); END IF;
  RETURN jsonb_build_object('ok',true,'propositions', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'poi_id',p.poi_id,'osm_id',p.osm_id,'nom',p.nom,'categorie',p.categorie,
      'tier_defaut',p.tier_defaut,'source',p.source,'niveau_confiance',p.niveau_confiance,
      'flag_pepite',p.flag_pepite,
      'geom_type', GeometryType(p.geom),                         -- POINT | LINESTRING | MULTILINESTRING... (front : circuit vs POI)
      'lon', ST_X(ST_PointOnSurface(p.geom)),                    -- point représentatif, valable tout type (fix B016)
      'lat', ST_Y(ST_PointOnSurface(p.geom))) ORDER BY p.flag_pepite DESC, p.nom)
    FROM poi.poi p WHERE p.statut_validation='propose'), '[]'::jsonb));
END $$;
COMMENT ON FUNCTION api.poi_propositions(text) IS 'M124 + A-18 : POI/circuits en attente de validation owner. Point représentatif ST_PointOnSurface (tout type géom) + geom_type pour le rendu front.';
GRANT EXECUTE ON FUNCTION api.poi_propositions(text) TO web_anon;
