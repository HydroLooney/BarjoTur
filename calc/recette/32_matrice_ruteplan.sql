-- 32_matrice_ruteplan.sql, matrice base-à-base sur le GRAPHE RUTEPLAN natif (31_reseau_ruteplan.sql).
-- Une seule méthode : dijkstra one-to-many par base source (104 runs), le graphe étant pleinement connecté (31 : 103/103
-- bases joignables, 12/12 ouest). On agrège sur le chemin, en utilisant le coût de dijkstra `d.cost` (déjà orienté, gère
-- les sens uniques -1) pour le temps, et ways_ruteplan (join sur id indexé, PAS de sous-requête corrélée) pour km + ferry.
--   minutes_roulage = Σ d.cost des arêtes routières / 60
--   minutes_ferry   = Σ d.cost des arêtes ferry (temps NVDB réel) / 60
--   km              = Σ length_m / 1000
--   n_ferries       = nb d'arêtes ferry sur le chemin
-- Écrit en STAGING (staging.matrice_ruteplan), NON destructif, NON promu. Gate C16 + delta vs live ace34bca en fin.
-- Usage : PGOPTIONS="-c client_min_messages=warning" psql -h localhost -p 5433 -d norvege_routing -v ON_ERROR_STOP=1 -f calc/recette/32_matrice_ruteplan.sql

\set ON_ERROR_STOP on

DROP TABLE IF EXISTS staging.matrice_ruteplan;
CREATE TABLE staging.matrice_ruteplan (
  source_base int, target_base int,
  minutes_roulage numeric, minutes_ferry numeric, km numeric,
  ferry boolean, n_ferries int, max_seg_route_m numeric
);

DO $$
DECLARE b RECORD;
BEGIN
  FOR b IN SELECT brn.base_id, brn.node_ruteplan
           FROM staging.base_ruteplan_node brn ORDER BY brn.base_id LOOP
    INSERT INTO staging.matrice_ruteplan
    SELECT b.base_id, nb.base_id,
      round((sum(d.cost) FILTER (WHERE NOT w.is_ferry)/60.0)::numeric, 1),
      round((coalesce(sum(d.cost) FILTER (WHERE w.is_ferry),0)/60.0)::numeric, 0),  -- 0 (pas NULL) si pas de ferry, sinon le total temps devient NULL
      round((sum(w.length_m)/1000.0)::numeric, 1),
      count(*) FILTER (WHERE w.is_ferry) > 0,
      count(*) FILTER (WHERE w.is_ferry),
      round(max(w.length_m) FILTER (WHERE NOT w.is_ferry)::numeric, 0)
    FROM pgr_dijkstra(
      'SELECT id, source, target, cost_s AS cost, reverse_cost_s AS reverse_cost FROM staging.ways_ruteplan',
      b.node_ruteplan,
      ARRAY(SELECT node_ruteplan FROM staging.base_ruteplan_node WHERE base_id <> b.base_id),
      directed := true) d
    JOIN staging.ways_ruteplan w ON w.id = d.edge AND d.edge <> -1
    JOIN staging.base_ruteplan_node nb ON nb.node_ruteplan = d.end_vid
    GROUP BY nb.base_id;
  END LOOP;
END $$;
CREATE INDEX ON staging.matrice_ruteplan(source_base, target_base);

-- Vérifications (avant toute promotion).
\echo '== A. Volumétrie (attendu 10712 hors diag) =='
SELECT count(*) paires, count(*) FILTER (WHERE minutes_roulage IS NULL) nulls FROM staging.matrice_ruteplan;
\echo '== B. Couverture ouest (bases lon<6 toutes joignables, 0 NULL) =='
SELECT count(DISTINCT m.target_base) ouest_cibles_joignables, (SELECT count(*) FROM mcda2.bases_v2 WHERE lon<6) attendu
FROM staging.matrice_ruteplan m JOIN mcda2.bases_v2 b ON b.base_id=m.target_base
WHERE b.lon<6 AND m.minutes_roulage IS NOT NULL;
\echo '== C. Symétrie temps total (attendu 0 asym >2min) =='
SELECT count(*) asym FROM staging.matrice_ruteplan a JOIN staging.matrice_ruteplan b2
  ON b2.source_base=a.target_base AND b2.target_base=a.source_base
WHERE a.source_base<>a.target_base
  AND abs((a.minutes_roulage+a.minutes_ferry)-(b2.minutes_roulage+b2.minutes_ferry))>2;
\echo '== D. Anti-téléport : plus longue arête routière sur un chemin (attendu pas d aberration géante) =='
SELECT round(max(max_seg_route_m)::numeric,0) max_seg_m,
       count(*) FILTER (WHERE max_seg_route_m>5000) paires_seg_sup_5km FROM staging.matrice_ruteplan;
\echo '== E. Ferry : n_ferries max, temps ferry max (min), paires ferry =='
SELECT max(n_ferries) max_ferries, round(max(minutes_ferry)::numeric,0) max_min_ferry, count(*) FILTER (WHERE ferry) paires_ferry
FROM staging.matrice_ruteplan WHERE source_base<>target_base;
\echo '== F. Delta temps total vs live (M021 ace34bca) =='
SELECT count(*) paires_change,
       round(avg(abs((c.minutes_roulage+c.minutes_ferry)-(l.minutes_roulage+l.minutes_ferry)))::numeric,1) delta_moy_min,
       round(max(abs((c.minutes_roulage+c.minutes_ferry)-(l.minutes_roulage+l.minutes_ferry)))::numeric,1) delta_max_min
FROM staging.matrice_ruteplan c JOIN mcda2.matrice_base_base l USING(source_base,target_base)
WHERE abs((c.minutes_roulage+c.minutes_ferry)-(l.minutes_roulage+l.minutes_ferry))>1;
\echo '== G. Empreinte déterministe staging.matrice_ruteplan =='
SELECT md5(string_agg(md5(t.*::text), '' ORDER BY t.source_base, t.target_base)) AS empreinte
FROM (SELECT source_base,target_base,minutes_roulage,minutes_ferry,km,ferry,n_ferries FROM staging.matrice_ruteplan) t;
