-- 81c_souszones_kommune.sql
-- BarjoTur / Worker A — Q-B (M258) : sous-zones = KOMMUNER (vraie maille administrative).
-- Source autoritaire : 357 kommuner norvegiens (kommunenummer + nom, robhop/Kartverket).
-- Methode : chaque kommune rattachee a la zone qui la contient (point representatif),
--           fallback = zone de plus grand recouvrement ; clippee a la zone (emboîtement strict).
--           Hors scope (aucun rattachement zone) = ecarte (nord de Trondheim, etc.).
-- Remplace centroïdes (81_) et Voronoi (81b). Staging, NON applique au live. Rejouable. R1 : integrite mesuree.

-- 1) rattachement kommune -> zone par MAX-RECOUVREMENT (tout kommune touchant une zone
--    avec >5% de sa surface est rattache a la zone qu'il recouvre le plus). ST_MakeValid partout.
DROP TABLE IF EXISTS staging.kommune_zone;
CREATE TABLE staging.kommune_zone AS
WITH k AS (
  SELECT kommunenummer AS knr, kommunenavn AS nom, ST_MakeValid(geom) AS geom
  FROM staging.kommuner_raw
),
zv AS (SELECT id, region_id, ST_MakeValid(geom) AS geom FROM decoupage.zones)
SELECT DISTINCT ON (k.knr) k.knr, k.nom, k.geom, z.id AS zone_id, z.region_id
FROM k JOIN zv z ON ST_Intersects(k.geom, z.geom)
WHERE ST_Area(ST_Intersection(k.geom, z.geom)::geography) > 0.05 * ST_Area(k.geom::geography)
ORDER BY k.knr, ST_Area(ST_Intersection(k.geom, z.geom)) DESC;

-- 2) sous-zones = kommune clippee a sa zone (emboîtement strict, 0 spill)
DROP TABLE IF EXISTS staging.souszones_kommune;
CREATE TABLE staging.souszones_kommune AS
SELECT kz.knr AS sous_zone_id, kz.nom, kz.zone_id, kz.region_id,
       ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_Intersection(kz.geom, z.geom)), 3)) AS geom
FROM staging.kommune_zone kz JOIN decoupage.zones z ON z.id = kz.zone_id;

-- 3) VERSION COUVRANTE : Voronoi des kommuner (point-sur-surface, garanti dans la terre)
--    clippe a la zone -> chaque sous-zone = kommune + sa part de mer/fjord adjacente.
--    Satisfait 0 trou / 0 chevauchement / 100% de la zone (Q-A garde l'etendue cotiere).
DROP TABLE IF EXISTS staging.souszones_kommune_couvrante;
CREATE TABLE staging.souszones_kommune_couvrante AS
WITH gen AS (
  SELECT kz.knr, kz.nom, kz.zone_id, kz.region_id,
         ST_PointOnSurface(kz.geom) AS pt
  FROM staging.kommune_zone kz
),
vor AS (
  SELECT z.id AS zone_id, ST_MakeValid(z.geom) AS zgeom,
         (ST_Dump(ST_VoronoiPolygons(ST_Collect(g.pt), 0, ST_MakeValid(z.geom)))).geom AS cell
  FROM decoupage.zones z JOIN gen g ON g.zone_id = z.id
  GROUP BY z.id, z.geom
)
SELECT g.knr AS sous_zone_id, g.nom, g.zone_id, g.region_id,
       ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_Intersection(v.cell, v.zgeom)), 3)) AS geom
FROM vor v JOIN gen g ON g.zone_id = v.zone_id AND ST_Contains(v.cell, g.pt);

\echo '=== VERSION COUVRANTE (sous_zone = kommune + part de mer) ==='
\echo '--- cellules (doit = kommuner rattachees) ---'
SELECT count(*) FROM staging.souszones_kommune_couvrante;
\echo '--- chevauchements intra-zone (doit=0) ---'
SELECT count(*) FROM staging.souszones_kommune_couvrante a JOIN staging.souszones_kommune_couvrante b
  ON a.sous_zone_id<b.sous_zone_id AND a.zone_id=b.zone_id
  WHERE ST_Area(ST_Intersection(a.geom,b.geom)::geography) > 1e5;
\echo '--- trou couvrant vs zone (km2, doit ~0) ---'
SELECT round((sum(ecart))::numeric,1) trou_km2 FROM (
  SELECT z.id, (ST_Area(z.geom::geography) - ST_Area(ST_Union(s.geom)::geography))/1e6 ecart
  FROM decoupage.zones z JOIN staging.souszones_kommune_couvrante s ON s.zone_id=z.id
  GROUP BY z.id, z.geom) x;

-- Contrôles d'integrite version pure-clip (R1)
\echo '=== VERSION PURE-CLIP (kommune terrestre, trou = mer) ==='
\echo '--- kommuner rattachees (in-scope) / total 357 ---'
SELECT count(*) rattachees FROM staging.souszones_kommune;
\echo '--- sous-zones par zone (min/moy/max) ---'
SELECT min(c), round(avg(c),1) moy, max(c) FROM (SELECT zone_id, count(*) c FROM staging.souszones_kommune GROUP BY 1) x;
\echo '--- chevauchements intra-zone (doit=0) ---'
SELECT count(*) FROM staging.souszones_kommune a JOIN staging.souszones_kommune b
  ON a.sous_zone_id<b.sous_zone_id AND a.zone_id=b.zone_id
  WHERE ST_Area(ST_Intersection(a.geom,b.geom)::geography) > 1e5;
\echo '--- couverture : trou total zone vs union kommuner (km2, doit ~0) ---'
SELECT round((sum(ecart))::numeric,1) trou_km2, round((sum(GREATEST(ecart,0)))::numeric,1) trou_positif_km2 FROM (
  SELECT z.id, (ST_Area(z.geom::geography) - ST_Area(ST_Union(s.geom)::geography))/1e6 ecart
  FROM decoupage.zones z JOIN staging.souszones_kommune s ON s.zone_id=z.id
  GROUP BY z.id, z.geom) x;
\echo '--- zones sans aucune sous-zone (doit=0) ---'
SELECT count(*) FROM decoupage.zones z WHERE NOT EXISTS (SELECT 1 FROM staging.souszones_kommune s WHERE s.zone_id=z.id);
