-- 30b_matrices_km.sql, complète la matrice A* : km réels + split roulage/ferry correct (A-02 increment 2).
-- Complète 30_matrices.sql (qui via pgr_aStarCostMatrix n'a que le coût-temps total, ni km ni split).
-- Méthode : pgr_dijkstra one-to-many par base source (105 appels, ~2 s chacun) sur ways_van, puis on
-- agrège le CHEMIN : km = somme length_m ; minutes_ferry = temps des arêtes synthétiques (traversées,
-- id>=900000000) ; minutes_roulage = temps des arêtes routières (id<900000000). Corrige les 4 négatifs
-- (l'ancien split soustrayait un temps ferry_leg sans rapport avec le chemin réel).
--
-- La GÉOMÉTRIE par paire n'est PAS stockée ici (surdimensionné pour 10 920 paires) : la preuve C16
-- « 0 segment terrestre >5km » se fait sur la geom FIGÉE (legs A* live de B), pas sur toute la matrice.
--
-- Idempotent (UPDATE), réversible (archive staging), non destructif. Doctrine A14.
-- Usage : psql -h localhost -p 5433 -d norvege_routing -v ON_ERROR_STOP=1 -f calc/recette/30b_matrices_km.sql

\set ON_ERROR_STOP on

-- Archive avant (réversibilité).
DROP TABLE IF EXISTS staging.matrice_base_base_avant_30b;
CREATE TABLE staging.matrice_base_base_avant_30b AS SELECT *, now() AS archive_le FROM mcda2.matrice_base_base;

-- Recalcul km + split, source par source (one-to-many dijkstra).
DO $$
DECLARE
  b RECORD;
  n_maj int := 0;
BEGIN
  FOR b IN SELECT base_id, node_van FROM mcda2.bases_v2 ORDER BY base_id LOOP
    WITH d AS (
      SELECT * FROM pgr_dijkstra(
        'SELECT id, source, target, cost_s AS cost, reverse_cost_s AS reverse_cost FROM mcda2.ways_van WHERE x1 IS NOT NULL AND id NOT IN (SELECT edge_id FROM mcda2.ways_van_exclusions)',
        b.node_van,
        ARRAY(SELECT node_van FROM mcda2.bases_v2 WHERE base_id != b.base_id),
        directed := true)
    ),
    agg AS (
      SELECT nb.base_id AS target_base,
             round((sum(w.length_m)/1000.0)::numeric, 1)                                        AS km,
             round((sum(w.cost_s) FILTER (WHERE w.id >= 900000000)/60.0)::numeric, 0)            AS min_ferry,
             round((sum(w.cost_s) FILTER (WHERE w.id <  900000000)/60.0)::numeric, 1)            AS min_roulage
      FROM d
      JOIN mcda2.ways_van w ON w.id = d.edge AND d.edge <> -1
      JOIN mcda2.bases_v2 nb ON nb.node_van = d.end_vid
      GROUP BY nb.base_id
    )
    UPDATE mcda2.matrice_base_base m
       SET km              = agg.km,
           minutes_ferry   = COALESCE(agg.min_ferry, 0),
           minutes_roulage = agg.min_roulage,
           ferry           = COALESCE(agg.min_ferry, 0) > 0
      FROM agg
     WHERE m.source_base = b.base_id AND m.target_base = agg.target_base;
    n_maj := n_maj + 1;
  END LOOP;
  RAISE NOTICE 'Sources traitées : %', n_maj;
END $$;

-- Vérifications (verification-before-completion).
\echo '== A. Négatifs restants (attendu 0) =='
SELECT count(*) AS neg FROM mcda2.matrice_base_base WHERE source_base <> target_base AND minutes_roulage < 0;
\echo '== B. Couverture km (attendu : ~10920 hors diag renseignées) =='
SELECT count(*) FILTER (WHERE km IS NOT NULL) AS km_ok, count(*) FILTER (WHERE source_base<>target_base) AS hors_diag
FROM mcda2.matrice_base_base;
\echo '== C. Stats (roulage h, km, paires ferry) =='
SELECT round(min(minutes_roulage)/60,1) h_min, round(avg(minutes_roulage)/60,1) h_avg, round(max(minutes_roulage)/60,1) h_max,
       round(avg(km),0) km_avg, count(*) FILTER (WHERE ferry) paires_ferry
FROM mcda2.matrice_base_base WHERE source_base<>target_base;
\echo '== D. Symétrie km (attendu : 0 paire avec km asymétrique >1km) =='
SELECT count(*) AS km_asym FROM mcda2.matrice_base_base a JOIN mcda2.matrice_base_base b
  ON b.source_base=a.target_base AND b.target_base=a.source_base
WHERE a.source_base<>a.target_base AND abs(COALESCE(a.km,0)-COALESCE(b.km,0)) > 1;
