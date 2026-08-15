-- 79_diffusion_views_dump.sql, vues diffusion v_web_* pour le dump fondateur + la carte de coulisses de C (M208).
-- 3 vues : v_web_poi (778 scorés + reward + tres_frequente), v_web_bases_ideales (points facility-location),
-- v_web_decoupage (polygones région/zone/sous-zone par enveloppe convexe des POI membres, champ `niveau`).
-- Contrat web = ces vues (le web ne lit QUE diffusion.v_web_*). Géom en 4326 pour le web (POI lignes → point-on-surface).
-- Usage : PGOPTIONS=... psql ... -f calc/recette/79_diffusion_views_dump.sql
\set ON_ERROR_STOP on

-- 1. v_web_poi : les 778 POI scorés, valeur + drapeau affluence + hiérarchie
CREATE OR REPLACE VIEW diffusion.v_web_poi AS
SELECT p.poi_id, p.nom, p.categorie, p.type_entite,
       d.region_id, d.zone_id,
       rp.tier, round(rp.v_poi::numeric,3) AS v_poi, round(rp.q::numeric,3) AS q, rp.tres_frequente,
       ST_Transform(ST_PointOnSurface(p.geom), 4326) AS geom
FROM mcda2.reward_poi rp
JOIN poi.poi p USING(poi_id)
LEFT JOIN mcda2.poi_decoupage d USING(poi_id);
COMMENT ON VIEW diffusion.v_web_poi IS 'Contrat web : 778 POI scorés, v_poi (reward promu), tier, tres_frequente (affluence A35), région/zone. Géom 4326.';

-- 2. v_web_bases_ideales : points bases (facility-location), pour la carte coulisses (M208)
CREATE OR REPLACE VIEW diffusion.v_web_bases_ideales AS
SELECT bi.base_id, bi.nom, bi.region_id,
       bi.retenue, bi.structurante, bi.mclp_rang, bi.zero_reward,
       round(bi.reward::numeric,2) AS reward, round(bi.rayonnement::numeric,3) AS rayonnement,
       bi.n_poi_atteignables,
       ST_Transform(bi.geom, 4326) AS geom
FROM mcda2.bases_ideales bi;
COMMENT ON VIEW diffusion.v_web_bases_ideales IS 'Contrat web (carte coulisses M208) : bases idéales = bases_v2 annotées facility-location. retenue (exclut 2 zero-reward), structurante (top 28 couverture), reward, rayonnement. Géom 4326.';

-- 3. v_web_decoupage : polygones région/zone/sous-zone (enveloppe convexe des POI membres), champ niveau
CREATE OR REPLACE VIEW diffusion.v_web_decoupage AS
WITH pts AS (SELECT d.region_id, d.zone_id, p.geom
             FROM mcda2.poi_decoupage d JOIN poi.poi p USING(poi_id) WHERE p.geom IS NOT NULL)
SELECT 'region' AS niveau, region_id AS id, region_id AS parent_id, count(*)::bigint n_poi,
       ST_Transform(ST_ConvexHull(ST_Collect(ST_PointOnSurface(geom))), 4326) AS geom
FROM pts WHERE region_id IS NOT NULL GROUP BY region_id
UNION ALL
SELECT 'zone', zone_id, region_id, count(*)::bigint,
       ST_Transform(ST_ConvexHull(ST_Collect(ST_PointOnSurface(geom))), 4326)
FROM pts WHERE zone_id IS NOT NULL GROUP BY zone_id, region_id
UNION ALL
SELECT 'sous_zone', sz.sous_zone_id, sz.zone_id, sz.n_poi,
       ST_Transform(sz.centroid, 4326)  -- sous_zone : centroïde seul (pas de membership POI → pas de polygone, R1)
FROM mcda2.sous_zone sz WHERE sz.centroid IS NOT NULL;
COMMENT ON VIEW diffusion.v_web_decoupage IS 'Contrat web (carte coulisses M208) : découpage. région/zone = enveloppe convexe (approx diagnostic) des POI membres ; sous_zone = centroïde seul (pas de membership POI). Champ niveau + parent_id. Géom 4326.';

\echo '== vues créées : comptes =='
SELECT 'v_web_poi' v, count(*) FROM diffusion.v_web_poi
UNION ALL SELECT 'v_web_bases_ideales', count(*) FROM diffusion.v_web_bases_ideales
UNION ALL SELECT 'v_web_decoupage', count(*) FROM diffusion.v_web_decoupage
UNION ALL SELECT 'decoupage/region', count(*) FROM diffusion.v_web_decoupage WHERE niveau='region'
UNION ALL SELECT 'decoupage/zone', count(*) FROM diffusion.v_web_decoupage WHERE niveau='zone'
UNION ALL SELECT 'decoupage/sous_zone', count(*) FROM diffusion.v_web_decoupage WHERE niveau='sous_zone';
