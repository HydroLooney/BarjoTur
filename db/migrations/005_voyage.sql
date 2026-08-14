-- 005_voyage.sql (M055, pré-écrit — NON exécuté ; à rejouer en DB2 au flip, règle DB2 owner-safe).
-- Pose l'INSTANCE VOYAGE (A19 §9) : table `voyage.instance` (origine/destination/titre par voyage) + RPC de lecture.
--
-- SURFACE : DB2 (norvege_v2). `voyage.instance` est PRÉCIEUSE (état voyage vivant) : à la denylist de sync B-15
-- (comme parcours.*/fige.*). Le dump DB1→DB2 ne doit jamais la toucher.
-- MULTI-VOYAGE (A18 §7.3, M055) : clé `voyage_id` en PK, aucun voyage codé en dur. Le voyage Norvège = une ligne seed.
-- IDEMPOTENT : CREATE ... IF NOT EXISTS + CREATE OR REPLACE + seed en ON CONFLICT DO NOTHING.
-- Usage (DB2, au flip) : psql "<dsn_db2>" -v ON_ERROR_STOP=1 -f db/migrations/005_voyage.sql

\set ON_ERROR_STOP on
BEGIN;

CREATE SCHEMA IF NOT EXISTS voyage;
COMMENT ON SCHEMA voyage IS 'Instance voyage A19 (origine/destination/étapes). PRÉCIEUSE : hors sync B-15.';

CREATE TABLE IF NOT EXISTS voyage.instance (
  voyage_id     bigint PRIMARY KEY,
  titre         text NOT NULL,
  depart_label  text NOT NULL,
  depart_lat    double precision NOT NULL,
  depart_lon    double precision NOT NULL,
  arrivee_label text NOT NULL,
  arrivee_lat   double precision NOT NULL,
  arrivee_lon   double precision NOT NULL,
  maj_at        timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE voyage.instance IS 'M055 : instance voyage (titre + point_depart/point_arrivee) par voyage. PK voyage_id = multi-voyage-ready. PRÉCIEUSE.';

-- Seed du voyage Norvège 2027 (une instance parmi d'autres ; A/R bouclé : arrivée = départ = domicile).
-- Coords Schweighouse-sur-Moder (approx, verifie:false — à confirmer au géocodage réel A/géo si besoin).
INSERT INTO voyage.instance (voyage_id, titre, depart_label, depart_lat, depart_lon, arrivee_label, arrivee_lat, arrivee_lon)
VALUES (1, 'Norvège 2027',
        '12 Coteau de la Pinède, 67590 Schweighouse-sur-Moder', 48.8281, 7.7139,
        '12 Coteau de la Pinède, 67590 Schweighouse-sur-Moder', 48.8281, 7.7139)
ON CONFLICT (voyage_id) DO NOTHING;

-- Lecture : rend l'instance au format contrat Voyage (point_depart/point_arrivee imbriqués).
CREATE OR REPLACE FUNCTION api.voyage_lire(p_voyage_id bigint)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=api,voyage,public,pg_temp AS $$
  SELECT jsonb_build_object(
    'voyage_id', v.voyage_id,
    'titre', v.titre,
    'point_depart',  jsonb_build_object('label', v.depart_label,  'lat', v.depart_lat,  'lon', v.depart_lon),
    'point_arrivee', jsonb_build_object('label', v.arrivee_label, 'lat', v.arrivee_lat, 'lon', v.arrivee_lon))
  FROM voyage.instance v WHERE v.voyage_id = p_voyage_id;
$$;
COMMENT ON FUNCTION api.voyage_lire(bigint) IS 'M055 : instance voyage au format contrat Voyage (NULL si absent). Lecture ouverte.';
GRANT EXECUTE ON FUNCTION api.voyage_lire(bigint) TO web_anon;

COMMIT;

-- ACCEPTATION (au flip) :
-- SELECT api.voyage_lire(1);  -- {voyage_id:1, titre:"Norvège 2027", point_depart:{label,lat,lon}, point_arrivee:{...}}
-- SELECT has_function_privilege('web_anon','api.voyage_lire(bigint)','EXECUTE');  -- t
