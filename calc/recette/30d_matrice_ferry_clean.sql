-- 30d_matrice_ferry_clean.sql, matrice base-à-base sur le graphe van FERRY REBÂTI DEPUIS NVDB (A044/M081).
-- Remplace le maillage ferry v2 (739 arêtes synthétiques, jusqu'à 583 km, degré 23) par les 211 arêtes ferry
-- PROPRES issues de NVDB (staging.ferry_edge_clean : un samband réel, drivetime NVDB, id>=950000000).
-- Edge SQL = routes van (id<9e8, hors exclusions) UNION arêtes ferry propres. Aucun 900000xxx synthétique.
-- Écrit en STAGING (staging.matrice_clean), NON destructif, NON promu. Vérifie : couverture ouest, symétrie,
-- 0 chaîne multi-ferry parasite, drivetime cohérent. La promotion + re-gate C16 se font après preuve (M081).
-- Usage : psql -h localhost -p 5433 -d norvege_routing -v ON_ERROR_STOP=1 -f calc/recette/30d_matrice_ferry_clean.sql

\set ON_ERROR_STOP on

-- 1. Cost-matrix A* (temps total) sur le graphe propre.
DROP TABLE IF EXISTS staging.matrice_clean_raw;
CREATE TABLE staging.matrice_clean_raw AS
SELECT m.start_vid, m.end_vid, m.agg_cost AS cost_s
FROM pgr_aStarCostMatrix(
  'SELECT id, source, target, cost_s AS cost, reverse_cost_s AS reverse_cost, x1,y1,x2,y2
     FROM mcda2.ways_van WHERE x1 IS NOT NULL AND id < 900000000
       AND id NOT IN (SELECT edge_id FROM mcda2.ways_van_exclusions)
   UNION ALL
   SELECT id, source, target, cost_s AS cost, reverse_cost_s AS reverse_cost, x1,y1,x2,y2
     FROM staging.ferry_edge_clean',
  ARRAY(SELECT node_van FROM mcda2.bases_v2 ORDER BY base_id),
  directed := true, heuristic := 2) m;
CREATE INDEX ON staging.matrice_clean_raw(start_vid, end_vid);

-- 2. Trace du chemin (dijkstra one-to-many) : km + split roulage/ferry propre.
DROP TABLE IF EXISTS staging.matrice_clean;
CREATE TABLE staging.matrice_clean (
  source_base int, target_base int, minutes_roulage numeric, minutes_ferry numeric,
  km numeric, ferry boolean, n_ferries int
);
DO $$
DECLARE b RECORD;
BEGIN
  FOR b IN SELECT base_id, node_van FROM mcda2.bases_v2 ORDER BY base_id LOOP
    INSERT INTO staging.matrice_clean
    SELECT b.base_id, nb.base_id,
      round((sum(w.cost) FILTER (WHERE w.id < 950000000)/60.0)::numeric, 1),
      round((sum(w.cost) FILTER (WHERE w.id >= 950000000)/60.0)::numeric, 0),
      round((sum(w.length_m)/1000.0)::numeric, 1),
      count(*) FILTER (WHERE w.id >= 950000000) > 0,
      count(*) FILTER (WHERE w.id >= 950000000)
    FROM pgr_dijkstra(
      'SELECT id, source, target, cost_s AS cost, reverse_cost_s AS reverse_cost
         FROM mcda2.ways_van WHERE x1 IS NOT NULL AND id < 900000000
           AND id NOT IN (SELECT edge_id FROM mcda2.ways_van_exclusions)
       UNION ALL
       SELECT id, source, target, cost_s AS cost, reverse_cost_s AS reverse_cost
         FROM staging.ferry_edge_clean',
      b.node_van,
      ARRAY(SELECT node_van FROM mcda2.bases_v2 WHERE base_id != b.base_id),
      directed := true) d
    JOIN LATERAL (
      SELECT d.edge, d.end_vid,
             COALESCE((SELECT cost_s FROM mcda2.ways_van WHERE id=d.edge),
                      (SELECT cost_s FROM staging.ferry_edge_clean WHERE id=d.edge)) AS cost,
             COALESCE((SELECT length_m FROM mcda2.ways_van WHERE id=d.edge),
                      (SELECT length_m FROM staging.ferry_edge_clean WHERE id=d.edge)) AS length_m,
             d.edge AS id
    ) w ON d.edge <> -1
    JOIN mcda2.bases_v2 nb ON nb.node_van = d.end_vid
    GROUP BY nb.base_id;
  END LOOP;
END $$;
CREATE INDEX ON staging.matrice_clean(source_base, target_base);

-- 3. Vérifications (avant toute promotion).
\echo '== A. Volumétrie (attendu 10712 hors diag) =='
SELECT count(*) FROM staging.matrice_clean;
\echo '== B. Couverture ouest (bases lon<6 joignables, 0 NULL) =='
SELECT count(DISTINCT m.target_base) bases_ouest_cibles, (SELECT count(*) FROM mcda2.bases_v2 WHERE lon<6) attendu,
       count(*) FILTER (WHERE m.minutes_roulage IS NULL) nulls
FROM staging.matrice_clean m JOIN mcda2.bases_v2 b ON b.base_id=m.target_base WHERE b.lon<6;
\echo '== C. Symétrie temps totale (attendu 0 asym >2min) =='
SELECT count(*) asym FROM staging.matrice_clean a JOIN staging.matrice_clean b2
  ON b2.source_base=a.target_base AND b2.target_base=a.source_base
WHERE a.source_base<>a.target_base AND abs((a.minutes_roulage+a.minutes_ferry)-(b2.minutes_roulage+b2.minutes_ferry))>2;
\echo '== D. Ferry propre : n_ferries max (attendu <=4, plus de chaine parasite), temps ferry max =='
SELECT max(n_ferries) max_ferries, round(max(minutes_ferry)::numeric,0) max_min_ferry,
       count(*) FILTER (WHERE n_ferries>4) chaines_suspectes, count(*) FILTER (WHERE ferry) paires_ferry
FROM staging.matrice_clean WHERE source_base<>target_base;
\echo '== E. Delta temps total vs live (M021 ace34bca) =='
SELECT count(*) paires_change, round(avg(abs((c.minutes_roulage+c.minutes_ferry)-(l.minutes_roulage+l.minutes_ferry)))::numeric,1) delta_moy,
       round(max(abs((c.minutes_roulage+c.minutes_ferry)-(l.minutes_roulage+l.minutes_ferry)))::numeric,1) delta_max
FROM staging.matrice_clean c JOIN mcda2.matrice_base_base l USING(source_base,target_base)
WHERE abs((c.minutes_roulage+c.minutes_ferry)-(l.minutes_roulage+l.minutes_ferry))>1;
