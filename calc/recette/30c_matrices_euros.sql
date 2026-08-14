-- 30c_matrices_euros.sql, matrice BI-CRITÈRE : temps + € (M073) + switch ferry NVDB (M053).
-- Trace le CHEMIN temps-optimal (pgr_dijkstra one-to-many, 104 sources) sur ways_van AVEC l'override ferry
-- (COALESCE ways_van_cout_override → temps NVDB autoritatif pour les traversées appariées ; c'est le vrai
-- lieu du switch : 30b lisait cost_s brut, l'override n'y arrivait pas). Sur le chemin on agrège :
--   km              = Σ length_m
--   min_ferry       = Σ cost(arêtes ferry id>=9e8, coût override) / 60   [temps ferry autoritatif]
--   min_roulage     = Σ cost(arêtes routières id<9e8) / 60
--   cout_ferry_eur  = Σ ways_van.prix_van_eur (arêtes ferry traversées ; tarif AutoPASS/estimé)
--   cout_peage_eur  = Σ ways_van_peage.prix_peage_eur (postes de péage NVDB traversés)
-- Le carburant (km × params) et le total sont calculés à la promotion.
-- Écrit d'ABORD en staging (non destructif). Promotion vers mcda2.matrice_base_base après gate C16 + delta (R1).
-- Idempotent, réversible. Doctrine A14. Variante = DEFAULT (temps-optimal, ferry+péage autorisés).
-- Usage : psql -h localhost -p 5433 -d norvege_routing -v ON_ERROR_STOP=1 -f calc/recette/30c_matrices_euros.sql

\set ON_ERROR_STOP on

DROP TABLE IF EXISTS staging.matrice_euros_calc;
CREATE TABLE staging.matrice_euros_calc (
  source_base int, target_base int,
  km numeric, min_ferry numeric, min_roulage numeric,
  cout_ferry_eur numeric, cout_peage_eur numeric,
  n_aretes_ferry int, n_postes_peage int
);

DO $$
DECLARE
  b RECORD;
  n_maj int := 0;
BEGIN
  FOR b IN SELECT base_id, node_van FROM mcda2.bases_v2 ORDER BY base_id LOOP
    INSERT INTO staging.matrice_euros_calc
    SELECT
      b.base_id                                                                    AS source_base,
      nb.base_id                                                                   AS target_base,
      round((sum(w.length_m)/1000.0)::numeric, 1)                                  AS km,
      round((sum(COALESCE(o.cost_s, w.cost_s)) FILTER (WHERE w.id >= 900000000)/60.0)::numeric, 0) AS min_ferry,
      round((sum(COALESCE(o.cost_s, w.cost_s)) FILTER (WHERE w.id <  900000000)/60.0)::numeric, 1) AS min_roulage,
      round(coalesce(sum(w.prix_van_eur) FILTER (WHERE w.id >= 900000000), 0)::numeric, 2)         AS cout_ferry_eur,
      round(coalesce(sum(pk.peage_eur), 0)::numeric, 2)                            AS cout_peage_eur,
      count(*) FILTER (WHERE w.id >= 900000000)                                    AS n_aretes_ferry,
      count(*) FILTER (WHERE pk.peage_eur IS NOT NULL)                             AS n_postes_peage
    FROM pgr_dijkstra(
           'SELECT w.id, w.source, w.target,
                   COALESCE(o.cost_s, w.cost_s)         AS cost,
                   COALESCE(o.cost_s, w.reverse_cost_s) AS reverse_cost
            FROM mcda2.ways_van w
            LEFT JOIN mcda2.ways_van_cout_override o ON o.edge_id = w.id
            WHERE w.x1 IS NOT NULL
              AND w.id NOT IN (SELECT edge_id FROM mcda2.ways_van_exclusions)',
           b.node_van,
           ARRAY(SELECT node_van FROM mcda2.bases_v2 WHERE base_id != b.base_id),
           directed := true) d
    JOIN mcda2.ways_van w ON w.id = d.edge AND d.edge <> -1
    LEFT JOIN mcda2.ways_van_cout_override o ON o.edge_id = w.id
    LEFT JOIN LATERAL (
      SELECT sum(p.prix_peage_eur) AS peage_eur
      FROM mcda2.ways_van_peage p WHERE p.edge_id = w.id
    ) pk ON true
    JOIN mcda2.bases_v2 nb ON nb.node_van = d.end_vid
    GROUP BY nb.base_id;
    n_maj := n_maj + 1;
  END LOOP;
  RAISE NOTICE 'Sources tracées : %', n_maj;
END $$;

CREATE INDEX ON staging.matrice_euros_calc (source_base, target_base);

-- Vérifications staging (avant toute promotion).
\echo '== A. Volumétrie (attendu 10712 hors diag) =='
SELECT count(*) FROM staging.matrice_euros_calc;
\echo '== B. Couverture € (paires avec ferry €, péage €) =='
SELECT count(*) FILTER (WHERE cout_ferry_eur > 0) paires_ferry_eur,
       count(*) FILTER (WHERE cout_peage_eur > 0) paires_peage_eur,
       round(avg(cout_ferry_eur) FILTER (WHERE cout_ferry_eur>0)::numeric,1) ferry_eur_moy,
       round(avg(cout_peage_eur) FILTER (WHERE cout_peage_eur>0)::numeric,2) peage_eur_moy
FROM staging.matrice_euros_calc;
\echo '== C. Delta temps vs live (impact switch ferry NVDB) =='
SELECT count(*) paires_temps_change,
       round(avg(abs((c.min_ferry+c.min_roulage) - (l.minutes_ferry+l.minutes_roulage)))::numeric,1) delta_moy_min,
       round(max(abs((c.min_ferry+c.min_roulage) - (l.minutes_ferry+l.minutes_roulage)))::numeric,1) delta_max_min
FROM staging.matrice_euros_calc c
JOIN mcda2.matrice_base_base l ON l.source_base=c.source_base AND l.target_base=c.target_base
WHERE abs((c.min_ferry+c.min_roulage) - (l.minutes_ferry+l.minutes_roulage)) > 1;
\echo '== D. Symétrie temps totale (attendu 0 paire asym >2min) =='
SELECT count(*) asym FROM staging.matrice_euros_calc a JOIN staging.matrice_euros_calc b2
  ON b2.source_base=a.target_base AND b2.target_base=a.source_base
WHERE abs((a.min_ferry+a.min_roulage)-(b2.min_ferry+b2.min_roulage)) > 2;
