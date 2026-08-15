-- 81b_souszones_tessellation.sql
-- BarjoTur / Worker A — OPTION Q-B (M248/M257) : sous-zones en POLYGONES TESSELLÉS.
-- PRÉPARÉ, NON APPLIQUÉ : staging seulement, en attente du GO Q-B de Guillaume.
-- But : rendre la tessellation push-button. Si Guillaume tranche "polygones tessellés",
--       ce script produit 102 cellules emboîtées (⋃ sous-zones d'une zone = la zone).
-- R1 : les centroïdes v2 sont des clusters POI ; 35/102 tombent hors zone admin.
--      Méthode robuste : générateur = centroïde snappé DANS sa zone, dédoublonné par jitter
--      déterministe (aucun point coïncident -> Voronoi non dégénéré), Voronoi clippé à la zone.
--      Chaque sous-zone garde son identité (sous_zone_id) et son rattachement.

DROP TABLE IF EXISTS staging.souszones_generateurs;
CREATE TABLE staging.souszones_generateurs AS
WITH snap AS (
  -- 1) snap dans la zone si dehors (point représentatif d'un petit tampon clippé)
  SELECT sz.sous_zone_id, sz.zone_id, sz.region_id,
         CASE WHEN ST_Contains(z.geom, sz.centroid) THEN sz.centroid
              ELSE ST_PointOnSurface(z.geom) END AS pt0
  FROM mcda2.sous_zone sz JOIN decoupage.zones z ON z.id = sz.zone_id
),
grp AS (
  -- 2) détecter les générateurs coïncidents dans une même zone (arrondi ~1m)
  SELECT *,
         row_number() OVER (PARTITION BY zone_id, round(ST_X(pt0)::numeric,5), round(ST_Y(pt0)::numeric,5)
                            ORDER BY sous_zone_id) - 1 AS k
  FROM snap
)
-- 3) jitter déterministe (k * ~2m) pour rendre distincts les points coïncidents
SELECT sous_zone_id, zone_id, region_id,
       CASE WHEN k = 0 THEN pt0
            ELSE ST_SetSRID(ST_MakePoint(ST_X(pt0) + k*0.00002, ST_Y(pt0) + k*0.00002), 4326) END AS gen
FROM grp;

DROP TABLE IF EXISTS staging.souszones_tessel;
CREATE TABLE staging.souszones_tessel AS
WITH vor AS (
  SELECT z.id AS zone_id, z.geom AS zgeom,
         (ST_Dump(ST_VoronoiPolygons(ST_Collect(g.gen), 0, z.geom))).geom AS cell
  FROM decoupage.zones z JOIN staging.souszones_generateurs g ON g.zone_id = z.id
  GROUP BY z.id, z.geom
)
SELECT g.sous_zone_id, g.zone_id, g.region_id,
       ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_Intersection(v.cell, v.zgeom)), 3)) AS geom
FROM vor v
JOIN staging.souszones_generateurs g
  ON g.zone_id = v.zone_id AND ST_Contains(v.cell, g.gen);

-- Contrôles d'intégrité (R1)
\echo '--- nb de cellules (doit = 102) ---'
SELECT count(*) FROM staging.souszones_tessel;
\echo '--- chevauchements intra-zone (doit = 0) ---'
SELECT count(*) FROM staging.souszones_tessel a JOIN staging.souszones_tessel b
  ON a.sous_zone_id<b.sous_zone_id AND a.zone_id=b.zone_id
  WHERE ST_Area(ST_Intersection(a.geom,b.geom)::geography) > 1e5;
\echo '--- trou total zone vs union sous-zones (km2, ~0) ---'
SELECT round((sum(ecart))::numeric,2) trou_km2 FROM (
  SELECT z.id, (ST_Area(z.geom::geography) - ST_Area(ST_Union(s.geom)::geography))/1e6 ecart
  FROM decoupage.zones z JOIN staging.souszones_tessel s ON s.zone_id=z.id
  GROUP BY z.id, z.geom) x;
\echo '--- cellules invalides (doit = 0) ---'
SELECT count(*) FROM staging.souszones_tessel WHERE NOT ST_IsValid(geom) OR ST_IsEmpty(geom);
