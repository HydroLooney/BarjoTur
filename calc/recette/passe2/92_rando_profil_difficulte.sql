-- 92_rando_profil_difficulte.sql
-- BarjoTur / Worker A — M287 D4b : difficulte rando v3 RELATIVE au profil familial (from-scratch).
-- Parties SANS DEM = jouables maintenant (est_boucle, echantillonnage 10m, params).
-- Parties AVEC DEM (D+/profil en long) = PUSH-BUTTON : attend DTM10 (Geonorge Hoydedata, Guillaume telecharge).
-- Non destructif, staging. R1 : le D+ ne se fabrique pas — NULL tant que le DEM n'est pas la.

-- 1) PARAMETRE profil familial (reglable cote app) — bornes acceptables
DROP TABLE IF EXISTS staging.profil_familial;
CREATE TABLE staging.profil_familial(
  cle text PRIMARY KEY, valeur numeric, unite text, commentaire text);
INSERT INTO staging.profil_familial VALUES
 ('dplus_max_jour', 800, 'm', 'D+ max confortable / jour (randonneurs familiaux bons marcheurs)'),
 ('pente_max_pct', 25, '%', 'pente max soutenue toleree'),
 ('duree_max_h', 5, 'h', 'duree max confortable'),
 ('longueur_max_km', 14, 'km', 'longueur max confortable'),
 ('bonus_boucle', 0.15, 'ratio', 'preference boucles > aller/retour');

-- 2) EST_BOUCLE (sans DEM) : depart ≈ arrivee (<100m) — favorise les boucles au scoring
DROP TABLE IF EXISTS staging.rando_profil;
CREATE TABLE staging.rando_profil AS
SELECT r.rando_id, r.poi_id, r.longueur_km,
  (ST_Distance(ST_StartPoint(ST_LineMerge(r.geom))::geography,
               ST_EndPoint(ST_LineMerge(r.geom))::geography) < 100) AS est_boucle,
  NULL::numeric AS dplus_m,      -- PUSH-BUTTON DEM
  NULL::numeric AS dmoins_m,     -- PUSH-BUTTON DEM
  NULL::numeric AS pente_moy_pct,-- PUSH-BUTTON DEM
  NULL::numeric AS pente_max_pct,-- PUSH-BUTTON DEM
  NULL::numeric AS difficulte_familiale  -- calculee en 3) apres DEM
FROM poi.rando r;
CREATE INDEX ON staging.rando_profil(rando_id);

-- 3) ECHANTILLONNAGE 10m + PROFIL EN LONG (PUSH-BUTTON)
--    R1/M301 : le DEM vit dans CARTOLOONEY, PAS dans dev/poi. On LIT les dalles in-place, on ne copie pas :
--      DEM = 130 dalles /Volumes/Disque USB 2 To/00_CartoLooney/sources/dtm10/*_10m_z33.tif (EPSG 25833).
--    Deux voies (au choix, sans jamais toucher le cluster 00_CartoLooney/pg/) :
--      (a) sampling externe (Python rasterio/gdal) : lire poi.rando de DB1 + les dalles CartoLooney, calculer D+/pente,
--          UPDATE staging.rando_profil. Aucune donnee carto recopiee dans dev.
--      (b) raster out-db PostGIS cote CARTOLOONEY (base carto), requete raster la-bas, resultat rapatrie.
--    Puis (equivalent SQL si raster accessible) :
--      -- points tous les 10 m le long du sentier (en metrique)
--      WITH pts AS (
--        SELECT r.rando_id,
--               (ST_DumpPoints(ST_Segmentize(ST_Transform(ST_LineMerge(r.geom),25833), 10))).geom AS pt
--        FROM poi.rando r),
--      z AS (SELECT rando_id, pt, ST_Value(d.rast, pt) AS alt
--            FROM pts JOIN staging.dtm10 d ON ST_Intersects(d.rast, pt))
--      -- D+ = somme des deltas positifs d'altitude le long du sentier ; pente = delta/10m
--      UPDATE staging.rando_profil rp SET dplus_m = ..., dmoins_m = ..., pente_moy_pct = ..., pente_max_pct = ...
--      FROM (agrégation par rando_id) x WHERE x.rando_id = rp.rando_id;
--
-- 4) DIFFICULTE FAMILIALE (apres DEM) = f(gradering officielle base, D+, longueur, pente, boucle, PROFIL)
--    difficulte_familiale = base_gradering
--        + w1*GREATEST(dplus_m/dplus_max_jour - 1, 0)        -- penalise le D+ au-dela du profil
--        + w2*GREATEST(pente_max_pct/pente_max_profil - 1,0) -- penalise la pente
--        + w3*GREATEST(longueur_km/longueur_max - 1, 0)
--        - bonus_boucle*(est_boucle)                         -- favorise les boucles
--    tout module par staging.profil_familial (parametre reglable, expose a l'app). NULL si D+ indisponible (R1).

\echo '--- est_boucle (sans DEM, jouable maintenant) ---'
SELECT count(*) total, count(*) FILTER (WHERE est_boucle) boucles,
       round(100.0*count(*) FILTER (WHERE est_boucle)/count(*),0) pct_boucles FROM staging.rando_profil;
\echo '--- profil familial (parametre) ---'
SELECT cle, valeur, unite FROM staging.profil_familial ORDER BY cle;
