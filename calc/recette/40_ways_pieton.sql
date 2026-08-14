-- 40_ways_pieton.sql, réseau PIÉTON autoritatif depuis Ruteplan (M064/M065/M087 : remplace l'OSM osm_pieton_raw).
-- Marchable = infra piétonne dédiée (Gang- og sykkelveg, Sti, Gangfelt, Sykkelveg) + routes locales (Enkel bilveg,
-- Kanalisert veg, Traktorveg de funcroadclass >= 2), HORS autoroutes/voies rapides (fc 0-1), rampes, bacs.
-- Bidirectionnel (le piéton ignore le oneway). Coût = longueur / vitesse marche (routing_params pieton_acces, 4,5 km/h).
-- Sert aux isochrones piéton d'accès (cap 25 min depuis parking). Topologie native fromnode/tonode (pas de snapping).
-- Usage : PGOPTIONS="-c client_min_messages=warning" psql -h localhost -p 5433 -d norvege_routing -v ON_ERROR_STOP=1 -f calc/recette/40_ways_pieton.sql

\set ON_ERROR_STOP on

-- Vitesse marche (m/s) depuis routing_params (single-source).
CREATE TEMP TABLE _vp AS SELECT (SELECT valeur FROM mcda2.routing_params WHERE profil='pieton_acces' AND param='vitesse_kmh')/3.6 AS ms;

DROP TABLE IF EXISTS mcda2.ways_pieton;
CREATE TABLE mcda2.ways_pieton AS
SELECT
  r.linkid AS id, r.fromnode AS source, r.tonode AS target,
  round((r.length / (SELECT ms FROM _vp))::numeric, 1) AS cost_s,
  round((r.length / (SELECT ms FROM _vp))::numeric, 1) AS reverse_cost_s,   -- bidirectionnel
  round(r.length::numeric, 1) AS length_m,
  r.roadtype,
  (r.roadtype IN ('Gang- og sykkelveg','Sti','Gangfelt','Sykkelveg')) AS infra_dediee,
  r.geom
FROM staging.ruteplan_links r
WHERE r.geom IS NOT NULL AND r.fromnode IS NOT NULL AND r.tonode IS NOT NULL
  AND r.isferry = 0 AND r.roadtype <> 'Rampe'
  AND (
    r.roadtype IN ('Gang- og sykkelveg','Sti','Gangfelt','Sykkelveg')
    OR (r.roadtype IN ('Enkel bilveg','Kanalisert veg','Traktorveg') AND r.funcroadclass >= 2)
  );
CREATE INDEX ON mcda2.ways_pieton(source);
CREATE INDEX ON mcda2.ways_pieton(target);
CREATE INDEX ON mcda2.ways_pieton USING gist(geom);
COMMENT ON TABLE mcda2.ways_pieton IS
 'Réseau piéton autoritatif Ruteplan (14/08) : infra dédiée + routes locales fc>=2, hors autoroute/rampe/bac. '
 'Bidirectionnel, coût = longueur / 4,5 km/h (routing_params). Remplace osm_pieton_raw. Script 40_.';

\echo '== volumétrie + composition (dédiée vs route locale) =='
SELECT count(*) liens, count(*) FILTER (WHERE infra_dediee) infra_dediee,
       round((sum(length_m)/1000.0)::numeric,0) km_reseau,
       count(DISTINCT roadtype) types
FROM mcda2.ways_pieton;
\echo '== par roadtype =='
SELECT roadtype, count(*) FROM mcda2.ways_pieton GROUP BY roadtype ORDER BY count(*) DESC;
\echo '== couverture : bases avec >=1 lien pieton a <500 m (accessibilite locale) =='
SELECT count(*) FILTER (WHERE EXISTS (
  SELECT 1 FROM mcda2.ways_pieton w WHERE ST_DWithin(w.geom, ST_Transform(b.geom,25833), 500)
)) bases_avec_pieton, count(*) total FROM mcda2.bases_v2 b;
