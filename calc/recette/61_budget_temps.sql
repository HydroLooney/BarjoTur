-- 61_budget_temps.sql, mapping POI→type + budget-temps résolu (A21/M089/M096).
-- M096 : activite auto-typée par mot-clé (kayak/safari/aventure), manger/logistique SANS budget-visite, override par lieu.
-- Livre : map catégorie→type (proposé), poi_activite (type + override + source), diffusion.v_web_poi_activite (contrat B),
-- et la fonction SQL partagée lib.duree_proposee(...) (une seule vérité, la RPC api.budget_temps_poi de B l'appelle).
-- Usage : PGOPTIONS="-c client_min_messages=warning" psql -h localhost -p 5433 -d norvege_routing -v ON_ERROR_STOP=1 -f calc/recette/61_budget_temps.sql

\set ON_ERROR_STOP on

-- 0. Nouveau type 'aventure' (canyoning / via ferrata), M096.
INSERT INTO mcda2.type_activite(code, libelle, min_min, defaut_min, max_min, granularite, granularites, themes) VALUES
 ('aventure', 'Aventure (canyoning, via ferrata)', 120, 180, 480, 'libre', NULL, ARRAY['aventure','nature'])
ON CONFLICT (code) DO NOTHING;

-- 1. Mapping catégorie POI → type (défauts « proposé », M096 ; activite traité à part par mot-clé).
DROP TABLE IF EXISTS mcda2.map_categorie_type_activite;
CREATE TABLE mcda2.map_categorie_type_activite(categorie text PRIMARY KEY, type_code text, statut text DEFAULT 'propose');
INSERT INTO mcda2.map_categorie_type_activite(categorie, type_code) VALUES
 ('rando','rando'), ('parc national','rando'), ('nature','rando'),
 ('point de vue','point_de_vue'), ('fjord','point_de_vue'), ('ile','point_de_vue'), ('phare','point_de_vue'),
 ('route panoramique','point_de_vue'), ('route_touristique','point_de_vue'), ('aire_design','point_de_vue'),
 ('musee','musee'), ('eglise','musee'), ('monument','musee'),
 ('plage','baignade'), ('cascade','cascade'), ('glacier','glacier'),
 ('ville','flanerie'), ('quartier','flanerie'), ('circuit_ville','flanerie'),
 -- logistique + autre = pas de budget-visite (M096) : type_code NULL
 ('dormir',NULL), ('manger',NULL), ('shopping',NULL), ('sortir',NULL), ('autre',NULL)
ON CONFLICT (categorie) DO NOTHING;

-- 2. Résolution par POI : type depuis mapping, ou mot-clé sous_categorie pour 'activite'. Override defaut_min = NULL (Guillaume).
DROP TABLE IF EXISTS mcda2.poi_activite;
CREATE TABLE mcda2.poi_activite(
  poi_id int PRIMARY KEY, type_code text NOT NULL, defaut_min_override int,
  source text NOT NULL DEFAULT 'type' CHECK (source IN ('type','lieu','preference','manuel'))
);
INSERT INTO mcda2.poi_activite(poi_id, type_code, source)
SELECT p.poi_id, t.type_code, 'type'
FROM poi.poi p
LEFT JOIN mcda2.map_categorie_type_activite m ON m.categorie = p.categorie
CROSS JOIN LATERAL (SELECT CASE
    WHEN p.categorie='activite' THEN CASE
        WHEN p.sous_categorie ILIKE '%kayak%' THEN 'kayak'
        WHEN p.sous_categorie ILIKE '%safari%' OR p.sous_categorie ILIKE '%faune%' THEN 'safari_faune'
        WHEN p.sous_categorie ILIKE '%canyon%' OR p.sous_categorie ILIKE '%ferrata%' THEN 'aventure'
        ELSE NULL END
    ELSE m.type_code END AS type_code) t
WHERE t.type_code IS NOT NULL;

-- 3. Fonctions partagées CANONIQUES (schéma neutre lib) — même fichier appliqué en DB1 ET DB2 (B047, migration 008 de B).
\i db/lib/duree_proposee.sql

-- 4. Contrat de diffusion pour B (inputs statiques par POI ; B applique la modulation live via duree_proposee).
DROP VIEW IF EXISTS diffusion.v_web_poi_activite;
CREATE VIEW diffusion.v_web_poi_activite AS
SELECT pa.poi_id, pa.type_code,
       t.min_min, coalesce(pa.defaut_min_override, t.defaut_min) AS defaut_min, t.max_min,
       t.granularite, t.granularites, t.themes,
       CASE WHEN pa.defaut_min_override IS NOT NULL THEN 'lieu' ELSE 'type' END AS source
FROM mcda2.poi_activite pa JOIN mcda2.type_activite t ON t.code = pa.type_code;
COMMENT ON VIEW diffusion.v_web_poi_activite IS 'Contrat B (A048/M096) : budget-temps statique par POI (type + défaut lieu||type). B sync DB2 + applique duree_proposee live.';

-- 5. Vérifs.
\echo '== POI typés / non typés (logistique+manger exclus) =='
SELECT (SELECT count(*) FROM poi.poi) poi_total, (SELECT count(*) FROM mcda2.poi_activite) poi_types,
       (SELECT count(*) FROM poi.poi)-(SELECT count(*) FROM mcda2.poi_activite) sans_budget;
\echo '== répartition par type =='
SELECT type_code, count(*) FROM mcda2.poi_activite GROUP BY type_code ORDER BY count(*) DESC;
\echo '== test duree_proposee : point de vue (def20 libre), kayak (palier), avec/ sans modulation =='
SELECT 'pdv neutre' k, lib.duree_proposee(20,15,90,'libre',NULL,1.0,1.0)
UNION ALL SELECT 'pdv coupdecoeur+appetit1', lib.duree_proposee(20,15,90,'libre',NULL,lib.facteur_avis('Coup de cœur'),lib.facteur_appetit(1))
UNION ALL SELECT 'kayak neutre (palier)', lib.duree_proposee(240,240,480,'demi_journee',ARRAY[240,480],1.0,1.0)
UNION ALL SELECT 'kayak fort appetit (palier)', lib.duree_proposee(240,240,480,'demi_journee',ARRAY[240,480],1.3,lib.facteur_appetit(1));
\echo '== vue B : 5 lignes =='
SELECT poi_id, type_code, min_min, defaut_min, granularite, themes FROM diffusion.v_web_poi_activite ORDER BY poi_id LIMIT 5;
