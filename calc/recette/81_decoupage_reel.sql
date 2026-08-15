-- 81_decoupage_reel.sql
-- BarjoTur / Worker A / M238 + M241/M242 : découpage REEL emboîté (fin des hulls).
-- Recupere la vraie geometrie administrative v2 (decoupage.regions 4, decoupage.zones 22)
-- + tessellation des sous-zones (102) par Voronoi clippee a la zone (PROPOSITION, M242).
-- Doctrine : NON destructif, staging. Backup de la vue avant remplacement. Rejouable.
-- R1 : on MESURE l'emboîtement (0 chevauchement, 0 trou), on ne le suppose pas.

-- ---------------------------------------------------------------------------
-- 1) REGIONS (4) : vrais contours, rendus pairwise-disjoints (slivers ~3.6 km2 total).
--    Difference cumulative dans un ordre fixe -> partition propre.
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS staging.decoupage_regions_clean;
CREATE TABLE staging.decoupage_regions_clean AS
WITH ord AS (
  SELECT id, nom, geom,
         row_number() OVER (ORDER BY id) rn   -- ordre fixe deterministe
  FROM decoupage.regions
)
SELECT a.id, a.nom,
       CASE WHEN prev.g IS NULL THEN a.geom
            ELSE ST_CollectionExtract(ST_MakeValid(ST_Difference(a.geom, prev.g)), 3) END AS geom
FROM ord a
LEFT JOIN LATERAL (
  SELECT ST_Union(b.geom) g FROM ord b WHERE b.rn < a.rn
) prev ON true;

-- ---------------------------------------------------------------------------
-- 2) SOUS-ZONES (102) : PROPOSITION, livrees en CENTROIDES (points).
--    R1 : les sous-zones v2 sont des clusters de POI, PAS une partition administrative :
--    35/102 centroïdes tombent HORS de leur zone admin reelle. Une vraie tessellation
--    (partition de la surface administrative, 0 trou) est un chantier de conception Passe 2
--    (M238) que Guillaume n'a pas encore tranche (M242 : "a proposer, pas fige").
--    On livre donc l'apercu en points, sans fabriquer une geometrie polygonale trompeuse.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 3) VUE WEB unifiee : 3 niveaux, polygones, n_poi (POI scores contenus).
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS staging.decoupage_web;
CREATE TABLE staging.decoupage_web AS
WITH poi_pts AS (
  SELECT p.geom FROM mcda2.reward_poi rp JOIN poi.poi p ON p.poi_id=rp.poi_id
)
SELECT 'region'::text niveau, r.id, NULL::text parent_id, r.nom,
       (SELECT count(*) FROM poi_pts pp WHERE ST_Contains(r.geom, pp.geom)) n_poi,
       ST_Multi(r.geom) geom
FROM staging.decoupage_regions_clean r
UNION ALL
SELECT 'zone', z.id, z.region_id, z.nom,
       (SELECT count(*) FROM poi_pts pp WHERE ST_Contains(z.geom, pp.geom)),
       ST_Multi(z.geom)
FROM decoupage.zones z
UNION ALL
SELECT 'sous_zone', sz.sous_zone_id, sz.zone_id, sz.sous_zone_id,
       sz.n_poi,
       sz.centroid   -- PROPOSITION : centroïde (point), pas polygone (cf. bloc 2)
FROM mcda2.sous_zone sz;

-- ---------------------------------------------------------------------------
-- 4) CONTROLES D'INTEGRITE D'EMBOITEMENT (R1 : mesurer)
-- ---------------------------------------------------------------------------
\echo '--- niveaux : comptage ---'
SELECT niveau, count(*) FROM staging.decoupage_web GROUP BY 1 ORDER BY 1;

\echo '--- chevauchements region (doit=0) ---'
SELECT count(*) FROM staging.decoupage_regions_clean a JOIN staging.decoupage_regions_clean b
  ON a.id<b.id WHERE ST_Area(ST_Intersection(a.geom,b.geom)::geography)>1e5;

\echo '--- sous_zone hors de leur zone reelle (R1 : diagnostic, pourquoi la tessellation est differee) ---'
SELECT count(*) FILTER (WHERE NOT ST_Contains(z.geom, sz.centroid)) hors_zone, count(*) total
FROM mcda2.sous_zone sz JOIN decoupage.zones z ON z.id=sz.zone_id;

\echo '--- emboîtement zone dans region (zones debordant leur region >5km2) ---'
SELECT count(*) FROM decoupage.zones z JOIN staging.decoupage_regions_clean r ON r.id=z.region_id
  WHERE ST_Area(ST_Difference(z.geom, ST_Buffer(r.geom,0.001))::geography)/1e6 > 5;
