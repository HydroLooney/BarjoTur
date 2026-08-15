-- 88_faciloc_greedy_rutepl.sql (M470 (d)) — GREEDY max-coverage pondéré v_poi sur le VRAI graphe (reachability ways_ruteplan).
-- Pré-requis : staging.floc_reach_rutepl peuplée (677 nœuds POI on-réseau × candidats <=90min). Produit la COURBE valeur<->N + set retenu.
-- Un POI compte 1x, capté si >=1 candidat retenu l'atteint. Identité candidat = cand_node (base ∪ van_ok du pool floc_candidat_rutepl).
-- DO block = boucle greedy sur tables PRÉ-CALCULÉES (rapide, pas un job pgr) → acceptable. Idempotent.
\set ON_ERROR_STOP on
BEGIN;
-- 1) valeur candidat->POI (dédupliquée) + v_poi v3
-- NB fix : join sur poi_NODE (pas poi_id) — floc_reach_rutepl a PK (poi_node,cand_node) donc 1 seul poi_id/nœud stocké ;
-- 36 nœuds portent 2+ POI. Le join par nœud rend à TOUS les POI d'un nœud atteignable ses candidats (récupère les ~36 perdus).
DROP TABLE IF EXISTS staging.floc_cand_poi_rutepl;
CREATE TABLE staging.floc_cand_poi_rutepl AS
SELECT DISTINCT fr.cand_node, fp.poi_id, fp.v_poi
FROM staging.floc_reach_rutepl fr
JOIN staging.floc_poi_rutepl fp ON fp.poi_node = fr.poi_node AND NOT fp.off_reseau;
CREATE INDEX ON staging.floc_cand_poi_rutepl(cand_node);
CREATE INDEX ON staging.floc_cand_poi_rutepl(poi_id);

DROP TABLE IF EXISTS staging.floc_univers_rutepl;
CREATE TABLE staging.floc_univers_rutepl AS
SELECT count(DISTINCT poi_id) AS n_poi_atteignables, sum(v) AS v_total
FROM (SELECT poi_id, max(v_poi) v FROM staging.floc_cand_poi_rutepl GROUP BY poi_id) u;

-- 2) GREEDY
DROP TABLE IF EXISTS staging.floc_covered_rutepl;  CREATE TABLE staging.floc_covered_rutepl(poi_id int PRIMARY KEY);
DROP TABLE IF EXISTS staging.floc_greedy_rutepl;   CREATE TABLE staging.floc_greedy_rutepl(
  rang int, cand_node bigint, cand_type text, ref_id text, marginal_v numeric, marginal_npoi int, cum_v numeric, cum_npoi int);

DO $$
DECLARE best record; cum_v numeric := 0; cum_n int := 0; rg int := 0; maxrang int := 200;
BEGIN
  LOOP
    SELECT cp.cand_node, sum(cp.v_poi) mv, count(*) mn
    FROM staging.floc_cand_poi_rutepl cp
    WHERE cp.poi_id NOT IN (SELECT poi_id FROM staging.floc_covered_rutepl)
      AND cp.cand_node NOT IN (SELECT cand_node FROM staging.floc_greedy_rutepl)
    GROUP BY cp.cand_node
    ORDER BY sum(cp.v_poi) DESC, count(*) DESC
    LIMIT 1 INTO best;
    EXIT WHEN best IS NULL OR best.mn = 0 OR rg >= maxrang;
    rg := rg + 1; cum_v := cum_v + best.mv; cum_n := cum_n + best.mn;
    INSERT INTO staging.floc_covered_rutepl
      SELECT DISTINCT poi_id FROM staging.floc_cand_poi_rutepl
      WHERE cand_node = best.cand_node AND poi_id NOT IN (SELECT poi_id FROM staging.floc_covered_rutepl);
    INSERT INTO staging.floc_greedy_rutepl
      SELECT rg, best.cand_node,
             (SELECT cand_type FROM staging.floc_candidat_rutepl c WHERE c.node_ruteplan=best.cand_node LIMIT 1),
             (SELECT ref_id    FROM staging.floc_candidat_rutepl c WHERE c.node_ruteplan=best.cand_node LIMIT 1),
             round(best.mv::numeric,3), best.mn, round(cum_v::numeric,3), cum_n;
  END LOOP;
  RAISE NOTICE 'greedy ruteplan TERMINÉ N=% cum_v=%/% cum_npoi=%/%', rg, round(cum_v::numeric,1),
    (SELECT round(v_total::numeric,1) FROM staging.floc_univers_rutepl), cum_n,
    (SELECT n_poi_atteignables FROM staging.floc_univers_rutepl);
END $$;
COMMIT;

-- 3) Courbe valeur<->N
\echo '== COURBE valeur<->N (ways_ruteplan) : coude = N optimal =='
SELECT g.rang, g.cand_type, round((g.cum_v/u.v_total*100)::numeric,1) AS pct_valeur,
       round((g.marginal_v/u.v_total*100)::numeric,2) AS gain_marginal_pct, g.cum_npoi
FROM staging.floc_greedy_rutepl g CROSS JOIN staging.floc_univers_rutepl u
WHERE g.rang IN (5,10,15,18,20,25,30,35,40,50) OR g.rang<=3 ORDER BY g.rang;
