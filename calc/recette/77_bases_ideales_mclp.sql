-- 77_bases_ideales_mclp.sql, bases idéales — MCLP glouton (facility location, M178) sur la matrice base→POI atteignable.
-- Sélectionne itérativement la base qui couvre le plus de VALEUR non encore couverte (Σ v_poi, cluster-dédup) → courbe
-- de couverture (n bases → % valeur). Montre l'efficacité de bases_v2 (peu de bases → forte couverture) et les redondances.
-- Densité pilotée par la valeur (v_poi), JAMAIS par les votes (M178). Lecture seule matrice + reward_poi. Table staging.
-- Usage : PGOPTIONS=... psql ... -f calc/recette/77_bases_ideales_mclp.sql
\set ON_ERROR_STOP on

DROP TABLE IF EXISTS staging.mclp_ordre;
CREATE TABLE staging.mclp_ordre(rang int, base_id int, val_marginale numeric, val_cumulee numeric, pct_cumule numeric, n_poi_nouveaux int);
DO $$
DECLARE
  tot numeric := (SELECT sum(v_poi) FROM mcda2.reward_poi WHERE poi_id IN (SELECT DISTINCT poi_id FROM staging.base_poi_reachable));
  r int := 0; cum numeric := 0; best RECORD;
BEGIN
  CREATE TEMP TABLE couvert(cluster_key geometry) ON COMMIT DROP;
  CREATE TEMP TABLE dispo(base_id int) ON COMMIT DROP;
  INSERT INTO dispo SELECT DISTINCT base_id FROM staging.base_poi_reachable;
  LOOP
    -- valeur marginale = Σ (max v_poi par cluster NON déjà couvert) pour chaque base dispo
    SELECT br.base_id,
           sum(cv.v_c) AS val, count(*) AS n
    INTO best
    FROM (SELECT base_id, cluster_key, max(v_poi) v_c
          FROM staging.base_poi_reachable
          WHERE cluster_key NOT IN (SELECT cluster_key FROM couvert)
            AND base_id IN (SELECT base_id FROM dispo)
          GROUP BY base_id, cluster_key) cv
    JOIN staging.base_poi_reachable br ON br.base_id=cv.base_id AND br.cluster_key=cv.cluster_key
    GROUP BY br.base_id
    ORDER BY val DESC NULLS LAST LIMIT 1;
    EXIT WHEN best.base_id IS NULL OR best.val IS NULL OR best.val <= 0;
    r := r + 1; cum := cum + best.val;
    INSERT INTO staging.mclp_ordre VALUES (r, best.base_id, round(best.val,2), round(cum,2), round(100.0*cum/tot,1), best.n);
    INSERT INTO couvert SELECT DISTINCT cluster_key FROM staging.base_poi_reachable
      WHERE base_id=best.base_id AND cluster_key NOT IN (SELECT cluster_key FROM couvert);
    DELETE FROM dispo WHERE base_id=best.base_id;
    EXIT WHEN r >= 60;
  END LOOP;
END $$;

\echo '== courbe MCLP : n bases pour atteindre les paliers de couverture (valeur) =='
SELECT min(rang) FILTER (WHERE pct_cumule>=50) n_pour_50pct, min(rang) FILTER (WHERE pct_cumule>=80) n_pour_80pct,
       min(rang) FILTER (WHERE pct_cumule>=90) n_pour_90pct, min(rang) FILTER (WHERE pct_cumule>=95) n_pour_95pct,
       max(rang) n_bases_utiles, max(pct_cumule) pct_max FROM staging.mclp_ordre;
\echo '== top 15 bases par apport marginal (les plus structurantes) =='
SELECT m.rang, b.nom, m.val_marginale, m.pct_cumule, m.n_poi_nouveaux FROM staging.mclp_ordre m JOIN mcda2.bases_v2 b USING(base_id) ORDER BY rang LIMIT 15;
\echo '== bases REDONDANTES (dans bases_v2 mais 0 apport marginal = jamais sélectionnées) =='
SELECT count(*) FROM mcda2.bases_v2 b WHERE b.base_id NOT IN (SELECT base_id FROM staging.mclp_ordre);
