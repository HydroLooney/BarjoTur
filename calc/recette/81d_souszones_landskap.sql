-- 81d_souszones_landskap.sql
-- BarjoTur / Worker A — Q-B CORRIGÉ (M260, Guillaume) : sous-zones NATURELLES/TOURISTIQUES.
-- Abandon kommune (81c superseded sur la BASE ; la MÉTHODE intersection∩zone + clip + contrôles se réutilise).
-- Base couvrante = NIBIO Landskapsregioner (Geonorge). Nommage = Miljodir. Naturvernomrader (parcs).
--
-- === PUSH-BUTTON, NON EXÉCUTÉ : attend la donnee NIBIO deposee par Guillaume dans data/source/ ===
-- Specs (M266) : SHP, 3 projections (EPSG 25832/25833/25835). DEUX couches :
--   landskapsregion (44, grain PRINCIPAL) + underlandskapsregion (444, grain fin OPTIONNEL).
-- GRAIN sous-zone par defaut = landskapsregion (44) ∩ zone (~30-40 sous-zones, coherent >=1 base/sous-zone).
--   ogr2ogr -f PostgreSQL PG:'...' <landskapsregion.shp>       -nln staging.landskap_raw \
--           -s_srs EPSG:25833 -t_srs EPSG:4326 -nlt PROMOTE_TO_MULTI -lco GEOMETRY_NAME=geom \
--           --config SHAPE_ENCODING "ISO-8859-1" -overwrite   -- (verifier accents norvegiens UTF-8/Latin-1)
--   ogr2ogr ... <underlandskapsregion.shp> -nln staging.landskap_fin_raw ... (grain fin optionnel, meme recette)
--   CREATE INDEX ON staging.landskap_raw USING gist(geom);
--   -- garder aussi une colonne geom_25833 (ST_Transform) pour les calculs metriques si besoin.
-- Champs : caler id/navn/code sur le SHP reel. Aperçu au grain 44 D'ABORD (M266), 444 en repli si trop grossier.
-- Nommage touristique : naturbase.aires_protegees (3512, 4326) DEJA en base (M261). Pas de vern_raw.

-- 1) SOUS-ZONE = landskapsregion ∩ zone (couvrant, emboîté, decoupe propre a la zone)
DROP TABLE IF EXISTS staging.souszones_landskap;
CREATE TABLE staging.souszones_landskap AS
WITH l AS (
  SELECT rsl_lreg::text AS landskap_id,
         lregnavn AS landskap_nom, ST_MakeValid(geom) AS geom
  FROM staging.landskap_raw
  WHERE COALESCE(pros_land,0) > 0   -- ecarte le residuel 100% hav (mer)
),
inter AS (
  SELECT z.id AS zone_id, z.region_id, l.landskap_id, l.landskap_nom,
         ST_Multi(ST_CollectionExtract(ST_MakeValid(
           ST_Intersection(l.geom, ST_MakeValid(z.geom))), 3)) AS geom
  FROM l JOIN decoupage.zones z ON ST_Intersects(l.geom, ST_MakeValid(z.geom))
)
SELECT zone_id, region_id, landskap_id, landskap_nom, geom
FROM inter
WHERE NOT ST_IsEmpty(geom)
  AND ST_Area(geom::geography) > 1e6;   -- ecarte les slivers < 1 km2

-- 2) NOMMAGE touristique : aire protegee DOMINANTE par sous-zone (naturbase.aires_protegees, M261).
--    Priorite nasjonalpark > landskapsvernomrade > autres ; sinon nom de landskapsregion.
ALTER TABLE staging.souszones_landskap ADD COLUMN sous_zone_id text;
ALTER TABLE staging.souszones_landskap ADD COLUMN nom text;
ALTER TABLE staging.souszones_landskap ADD COLUMN parc_forme text;
WITH dom AS (
  SELECT DISTINCT ON (s.zone_id, s.landskap_id)
         s.zone_id, s.landskap_id,
         coalesce(v.nom_officiel, v.nom) AS parc, v.forme_protection
  FROM staging.souszones_landskap s
  JOIN naturbase.aires_protegees v ON ST_Intersects(s.geom, ST_MakeValid(v.geom))
  ORDER BY s.zone_id, s.landskap_id,
           -- priorite touristique par forme, puis par surface de recouvrement
           CASE v.forme_protection WHEN 'nasjonalpark' THEN 3
                WHEN 'landskapsvernområde' THEN 2 ELSE 1 END DESC,
           ST_Area(ST_Intersection(s.geom, ST_MakeValid(v.geom))) DESC
)
UPDATE staging.souszones_landskap s
SET nom = COALESCE(d.parc, s.landskap_nom),
    parc_forme = d.forme_protection,
    sous_zone_id = s.zone_id || '__' || s.landskap_id
FROM dom d
WHERE d.zone_id = s.zone_id AND d.landskap_id = s.landskap_id;
-- sous-zones sans parc : garder le nom de paysage
UPDATE staging.souszones_landskap
SET nom = COALESCE(nom, landskap_nom),
    sous_zone_id = COALESCE(sous_zone_id, zone_id || '__' || landskap_id)
WHERE sous_zone_id IS NULL;

-- 3) CONTRÔLES D'INTÉGRITÉ (R1)
\echo '--- sous-zones naturelles : compte + par zone ---'
SELECT count(*) total, count(DISTINCT zone_id) zones FROM staging.souszones_landskap;
\echo '--- chevauchements intra-zone (doit=0) ---'
SELECT count(*) FROM staging.souszones_landskap a JOIN staging.souszones_landskap b
  ON a.sous_zone_id<b.sous_zone_id AND a.zone_id=b.zone_id
  WHERE ST_Area(ST_Intersection(a.geom,b.geom)::geography) > 1e5;
\echo '--- couverture : trou zone vs union sous-zones (km2, doit ~0) ---'
SELECT round((sum(ecart))::numeric,1) trou_km2 FROM (
  SELECT z.id, (ST_Area(ST_MakeValid(z.geom)::geography) - ST_Area(ST_Union(s.geom)::geography))/1e6 ecart
  FROM decoupage.zones z JOIN staging.souszones_landskap s ON s.zone_id=z.id
  GROUP BY z.id, z.geom) x;
\echo '--- zones sans sous-zone (doit=0) ---'
SELECT count(*) FROM decoupage.zones z WHERE NOT EXISTS (SELECT 1 FROM staging.souszones_landskap s WHERE s.zone_id=z.id);

-- 4) Export + apercu : voir le bloc bash du rapport (ogr2ogr decoupage.geojson + render geopandas).
--    Aperçu OBLIGATOIRE avant de figer (M260). v_web_decoupage + dump final APRÈS validation Guillaume.
