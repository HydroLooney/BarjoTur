-- 62_diffusion_sentiers.sql, couche d'AFFICHAGE des sentiers rando (T048, contrat C) depuis Turrutebasen.
-- Join fotrute (géométrie) + fotruteinfo (nom, difficulté). Géométrie simplifiée + reprojetée 4326 pour le web (Leaflet).
-- PAS de routage ici (le graphe routable ways_rando = noding séparé). Difficulté = gradering DNT (G/B/R/S), honnête sur les
-- non gradés (R1). Vue légère ; C peut la matérialiser si besoin de perf.
-- Usage : PGOPTIONS="-c client_min_messages=warning" psql -h localhost -p 5433 -d norvege_routing -v ON_ERROR_STOP=1 -f calc/recette/62_diffusion_sentiers.sql

\set ON_ERROR_STOP on

-- Une ligne par SEGMENT (fotrute.objid) : un segment partagé par plusieurs routes nommées ne se dessine qu'une fois.
-- Difficulté = la plus SÉVÈRE parmi ses routes (prudence rando) ; noms agrégés.
DROP VIEW IF EXISTS diffusion.v_web_sentiers;
CREATE VIEW diffusion.v_web_sentiers AS
WITH info AS (
  SELECT fotrute_fk,
    max(CASE upper(coalesce(gradering,''))
      WHEN 'S' THEN 4 WHEN 'R' THEN 3 WHEN 'B' THEN 2 WHEN 'G' THEN 1 ELSE 0 END) AS sev,
    string_agg(DISTINCT nullif(rutenavn,''), ' · ') AS noms
  FROM turogfriluftsruter_9fb60114b8f347e69d38b16e28f25d33.fotruteinfo GROUP BY fotrute_fk
)
SELECT
  f.objid,
  i.noms AS nom,
  CASE coalesce(i.sev,0)
    WHEN 4 THEN 'expert' WHEN 3 THEN 'difficile' WHEN 2 THEN 'moyen' WHEN 1 THEN 'facile'
    ELSE 'non gradé' END AS difficulte,          -- I / vide / autre = non gradé (R1, pas d'invention)
  f.underlagstype AS surface,
  f.sesong AS saison,
  round(ST_Length(f.senterlinje)::numeric, 0) AS length_m,
  ST_Transform(ST_SimplifyPreserveTopology(f.senterlinje, 10), 4326) AS geom   -- 10 m en 25833, web-léger
FROM turogfriluftsruter_9fb60114b8f347e69d38b16e28f25d33.fotrute f
LEFT JOIN info i ON i.fotrute_fk = f.objid;
COMMENT ON VIEW diffusion.v_web_sentiers IS
 'T048 : sentiers Turrutebasen pour affichage web (C). Géométrie simplifiée 10 m reprojetée 4326. Difficulté DNT (G/B/R/S), reste = non gradé. Script 62_.';

\echo '== volumétrie + répartition difficulté =='
SELECT difficulte, count(*), round((sum(length_m)/1000)::numeric,0) km FROM diffusion.v_web_sentiers GROUP BY difficulte ORDER BY count(*) DESC;
\echo '== SRID de sortie (4326 attendu) =='
SELECT DISTINCT ST_SRID(geom) FROM diffusion.v_web_sentiers LIMIT 1;
