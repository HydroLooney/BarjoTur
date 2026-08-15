-- 80_calques_poi_echantillon.sql
-- BarjoTur / Worker A / M225-M227 chantier 1 : matiere pour les CALQUES POI de C.
-- Objectif : fournir a C un GeoJSON statique par couche activable, categorie propre
--            et stable, randos et circuits en lignes quand la donnee existe.
-- Doctrine : NON destructif, NE TOUCHE NI le dump gele NI le schema diffusion.
--            On materialise des vues dans le schema staging (surface Worker A),
--            l'export ogr2ogr lit ces vues. Rejouable.
-- R1 : la categorie_calque DERIVE du champ reel poi.categorie (consolidation de
--      variantes d'orthographe et de synonymes), aucune categorie fabriquee.
--      La difficulte des sentiers est VIDE en base (trou T047/DEM) -> exposee NULL,
--      a renseigner en Passe 2. Les circuits n'ont pas de geometrie ligne
--      (14 marqueurs POINT, ni GPX ni membres ordonnes) -> livres en points, signale.

-- =============================================================================
-- 1) CALQUE POINTS : les 778 POI scores, categorie normalisee stable
-- =============================================================================
DROP VIEW IF EXISTS staging.calque_poi;
CREATE VIEW staging.calque_poi AS
SELECT
    p.poi_id,
    p.nom,
    p.categorie                       AS categorie_source,
    NULLIF(p.sous_categorie, '')      AS sous_categorie_source,
    -- categorie_calque : consolidation stable des 41 categories reelles en ~17 buckets
    CASE lower(trim(p.categorie))
        WHEN 'point de vue' THEN 'point_de_vue'
        WHEN 'belvedere'    THEN 'point_de_vue'
        WHEN 'repere'       THEN 'point_de_vue'
        WHEN 'paroi'        THEN 'point_de_vue'
        WHEN 'point-interet' THEN 'point_de_vue'
        WHEN 'cascade'      THEN 'cascade'
        WHEN 'glacier'      THEN 'glacier'
        WHEN 'fjord'        THEN 'fjord'
        WHEN 'nature'       THEN 'nature'
        WHEN 'vallee'       THEN 'nature'
        WHEN 'lac'          THEN 'nature'
        WHEN 'parc national' THEN 'parc_national'
        WHEN 'plage'        THEN 'plage'
        WHEN 'ile'          THEN 'ile'
        WHEN 'rando'        THEN 'rando'
        WHEN 'ville'        THEN 'ville'
        WHEN 'village'      THEN 'ville'
        WHEN 'quartier'     THEN 'ville'
        WHEN 'musee'        THEN 'culture'
        WHEN 'eglise'       THEN 'culture'
        WHEN 'monument'     THEN 'culture'
        WHEN 'patrimoine'   THEN 'culture'
        WHEN 'manger'       THEN 'restauration'
        WHEN 'cafe'         THEN 'restauration'
        WHEN 'brasserie'    THEN 'restauration'
        WHEN 'sortir'       THEN 'restauration'
        WHEN 'dormir'       THEN 'hebergement'
        WHEN 'activite'     THEN 'activite'
        WHEN 'sauna'        THEN 'activite'
        WHEN 'festival'     THEN 'activite'
        WHEN 'shopping'     THEN 'activite'
        WHEN 'route panoramique' THEN 'route'
        WHEN 'route_touristique' THEN 'route'
        WHEN 'route'        THEN 'route'
        WHEN 'train-panoramique' THEN 'route'
        WHEN 'itineraire-velo'   THEN 'route'
        WHEN 'circuit_ville' THEN 'route'
        WHEN 'aire_design'  THEN 'aire'
        WHEN 'phare'        THEN 'phare'
        ELSE 'autre'  -- 'autre', 'conseil-acces', et tout non prevu
    END                               AS categorie_calque,
    p.region_id,
    p.zone_id,
    rp.tier,
    round(rp.v_poi::numeric, 3)       AS v_poi,
    coalesce(rp.tres_frequente, false) AS tres_frequente,
    st_transform(p.geom, 4326)        AS geom
FROM mcda2.reward_poi rp
JOIN poi.poi p ON p.poi_id = rp.poi_id;

-- =============================================================================
-- 2) CALQUE SENTIERS (lignes) : randos curees du voyage (poi.rando)
--    2817 traces MultiLineString, toutes liees a un poi_id, longueur renseignee.
--    difficulte VIDE en base -> NULL (T047/DEM a venir).
-- =============================================================================
DROP VIEW IF EXISTS staging.calque_sentiers;
CREATE VIEW staging.calque_sentiers AS
SELECT
    r.rando_id,
    r.poi_id,
    r.nom,
    round(r.longueur_km::numeric, 2)  AS longueur_km,
    NULLIF(r.difficulte, '')          AS difficulte,   -- NULL tant que T047 non joue
    NULLIF(r.underlagstype, '')       AS surface,
    NULLIF(r.sesong, '')              AS saison,
    NULLIF(r.merking, '')             AS balisage,
    r.source,
    st_simplifypreservetopology(st_transform(r.geom, 4326), 0.0002) AS geom
FROM poi.rando r;

-- =============================================================================
-- 3) CALQUE CIRCUITS : 14 circuits a pied de ville.
--    R1 : PAS de geometrie ligne disponible (geom = POINT, GPX vide,
--    1 seul membre par circuit) -> livres en POINTS, ligne = enrichissement Passe 2.
-- =============================================================================
DROP VIEW IF EXISTS staging.calque_circuits;
CREATE VIEW staging.calque_circuits AS
SELECT
    c.circuit_id,
    c.nom,
    c.type,
    c.mode,
    c.zone_id,
    st_transform(c.geom, 4326)        AS geom
FROM poi.circuit c;

-- Controles rapides
\echo '--- calque_poi : repartition categorie_calque ---'
SELECT categorie_calque, count(*) FROM staging.calque_poi GROUP BY 1 ORDER BY 2 DESC;
\echo '--- calque_sentiers : n, longueur, difficulte renseignee ---'
SELECT count(*) n, count(difficulte) has_diff, round(avg(longueur_km),1) len_moy FROM staging.calque_sentiers;
\echo '--- calque_circuits : n ---'
SELECT count(*) n, GeometryType(geom) gt FROM staging.calque_circuits GROUP BY 2;
