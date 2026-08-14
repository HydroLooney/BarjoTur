-- 55_poi_decoupage.sql (tâche A-12 : appartenance POI -> zone/région, REJOUABLE).
-- Corrige le bug v2 (poi.poi.zone_id se périme quand le découpage bouge) : `mcda2.poi_decoupage` est une couche
-- DÉRIVÉE, régénérée à chaque changement de découpage. Agrégats d'affichage seulement (doctrine doc 09).
--
-- État vérifié (14/08) qui justifie la refonte : sur 1987 POI vivants, seuls 609 ont un zone_id (1378 NULL),
-- 1107 en drift vs la jointure spatiale, 273 hors de toute zone. SRID cohérent (4326).
--
-- PRIORITÉ d'affectation (déterministe) :
--   1. OVERRIDE curé : `decoupage.zones_membres` (feature_id = poi.osm_id ; 425 POI) prime sur la géométrie
--      (ex. features de bord de zone assignés à la main). Zone valide requise.
--   2. SPATIAL : ST_Within(poi.geom, zone.geom). DISTINCT ON pour les rares recouvrements.
--   3. PLUS_PROCHE : POI hors de toute zone -> zone la plus proche SI <= 50 km (bord de découpage).
--   4. HORS_DECOUPAGE : au-delà de 50 km (ex. POI de Suède `vault:est-suede`) -> zone NULL, tracé honnêtement.
-- La RÉGION vient toujours de `decoupage.zones.region_id` (source de vérité), jamais de zones_membres.region_id.
--
-- poi.poi READ-ONLY (on n'écrit pas zone_id source). Idempotent. Soft-merged exclus.
-- Usage : psql -h localhost -p 5433 -d norvege_routing -v ON_ERROR_STOP=1 -f calc/recette/55_poi_decoupage.sql

\set ON_ERROR_STOP on
\set seuil_proche_m 50000
BEGIN;

DROP TABLE IF EXISTS mcda2.poi_decoupage;
CREATE TABLE mcda2.poi_decoupage (
  poi_id    bigint PRIMARY KEY,
  zone_id   text,                 -- NULL si hors découpage
  region_id text,                 -- de decoupage.zones.region_id (autorité)
  methode   text NOT NULL,        -- override_cure | spatial | plus_proche | hors_decoupage
  dist_m    double precision      -- distance à la zone (0 si dans/override ; >0 si plus_proche)
);

WITH vivants AS (
  SELECT poi_id, osm_id, geom FROM poi.poi WHERE merged_into_poi_id IS NULL
),
-- 1. Override curé (zone_id valide seulement).
ov AS (
  SELECT v.poi_id, m.zone_id, 'override_cure'::text AS methode, 0::float AS dist_m
  FROM vivants v
  JOIN decoupage.zones_membres m ON m.feature_id = v.osm_id
  JOIN decoupage.zones z ON z.id = m.zone_id            -- garantit la validité du zone_id
),
-- 2. Spatial (POI non overridés, dans une zone ; DISTINCT ON gère les recouvrements).
sp AS (
  SELECT DISTINCT ON (v.poi_id) v.poi_id, z.id AS zone_id, 'spatial'::text AS methode, 0::float AS dist_m
  FROM vivants v
  JOIN decoupage.zones z ON ST_Within(v.geom, z.geom)
  WHERE v.poi_id NOT IN (SELECT poi_id FROM ov)
  ORDER BY v.poi_id, z.id
),
-- 3. Plus proche (reste, <= seuil).
reste AS (
  SELECT v.poi_id, v.geom FROM vivants v
  WHERE v.poi_id NOT IN (SELECT poi_id FROM ov) AND v.poi_id NOT IN (SELECT poi_id FROM sp)
),
pp AS (
  SELECT r.poi_id, nn.zone_id,
         CASE WHEN nn.dist_m <= :seuil_proche_m THEN 'plus_proche' ELSE 'hors_decoupage' END AS methode,
         nn.dist_m
  FROM reste r
  CROSS JOIN LATERAL (
    SELECT z.id AS zone_id, ST_Distance(r.geom::geography, z.geom::geography) AS dist_m
    FROM decoupage.zones z ORDER BY r.geom <-> z.geom LIMIT 1
  ) nn
),
assemble AS (
  SELECT poi_id, zone_id, methode, dist_m FROM ov
  UNION ALL SELECT poi_id, zone_id, methode, dist_m FROM sp
  UNION ALL SELECT poi_id, CASE WHEN methode='hors_decoupage' THEN NULL ELSE zone_id END, methode, dist_m FROM pp
)
INSERT INTO mcda2.poi_decoupage (poi_id, zone_id, region_id, methode, dist_m)
SELECT a.poi_id, a.zone_id, z.region_id, a.methode, a.dist_m
FROM assemble a LEFT JOIN decoupage.zones z ON z.id = a.zone_id;

COMMENT ON TABLE mcda2.poi_decoupage IS
  'A-12 : appartenance POI -> zone/région, REJOUABLE (corrige le drift v2 de poi.poi.zone_id). Priorité '
  'override_cure(zones_membres) > spatial(ST_Within) > plus_proche(<=50km) > hors_decoupage. Région = zones.region_id. '
  '55_poi_decoupage.sql. À rejouer à chaque changement de découpage.';

COMMIT;

-- Vérifications (verification-before-completion).
\echo '== couverture + méthode =='
SELECT methode, count(*), count(*) FILTER (WHERE zone_id IS NOT NULL) avec_zone,
       round(max(dist_m)::numeric,0) dist_max_m
FROM mcda2.poi_decoupage GROUP BY 1 ORDER BY 2 DESC;
\echo '== total couvert vs vivants =='
SELECT (SELECT count(*) FROM poi.poi WHERE merged_into_poi_id IS NULL) vivants,
       (SELECT count(*) FROM mcda2.poi_decoupage) lignes,
       (SELECT count(*) FROM mcda2.poi_decoupage WHERE zone_id IS NOT NULL) avec_zone,
       (SELECT count(*) FROM mcda2.poi_decoupage WHERE zone_id IS NULL) hors_decoupage;
\echo '== répartition par région (autorité zones.region_id) =='
SELECT COALESCE(region_id,'(hors)') region, count(*) FROM mcda2.poi_decoupage GROUP BY 1 ORDER BY 2 DESC;
\echo '== cohérence : toute zone affectée a bien une région ? (0 attendu) =='
SELECT count(*) AS zones_sans_region FROM mcda2.poi_decoupage WHERE zone_id IS NOT NULL AND region_id IS NULL;
