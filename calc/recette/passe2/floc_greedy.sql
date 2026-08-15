-- Facility-loc v3 (M370) : ré-optimisation densité+position par GREEDY max-coverage pondéré v_poi.
-- Pré-requis : staging.floc_reach peuplée (matrice candidat->POI <=90min, job buq3sgvav commité).
-- Produit : la COURBE valeur<->N (rendement décroissant) + le set retenu + le rationale densité.
-- Objectif = maximiser la valeur v3 captable par le composeur (un POI compte 1x, capté si >=1 base retenue l'atteint).

BEGIN;
-- 1) Valeur candidat->POI (dédupliquée) : chaque candidat, les POI qu'il atteint <=90min + v_poi v3
DROP TABLE IF EXISTS staging.floc_cand_poi;
CREATE TABLE staging.floc_cand_poi AS
SELECT DISTINCT fc.cand_id, fc.source, fp.poi_id, fp.v_poi
FROM staging.floc_reach fr
JOIN staging.floc_candidat fc ON fc.node_van = fr.cand_node
JOIN staging.floc_poi      fp ON fp.poi_node = fr.poi_node;
CREATE INDEX ON staging.floc_cand_poi(cand_id);
CREATE INDEX ON staging.floc_cand_poi(poi_id);

-- valeur totale atteignable (borne haute = union de tous les candidats)
DROP TABLE IF EXISTS staging.floc_univers;
CREATE TABLE staging.floc_univers AS
SELECT count(DISTINCT poi_id) AS n_poi_atteignables, sum(v) AS v_total
FROM (SELECT poi_id, max(v_poi) v FROM staging.floc_cand_poi GROUP BY poi_id) u;

-- 2) GREEDY pondéré : à chaque rang, le candidat au plus grand marginal de v_poi non encore capté
DROP TABLE IF EXISTS staging.floc_covered;   CREATE TABLE staging.floc_covered(poi_id int PRIMARY KEY);
DROP TABLE IF EXISTS staging.floc_greedy;    CREATE TABLE staging.floc_greedy(
  rang int, cand_id text, source text, marginal_v numeric, marginal_npoi int, cum_v numeric, cum_npoi int);

DO $$
DECLARE best record; cum_v numeric := 0; cum_n int := 0; rg int := 0; maxrang int := 150;
BEGIN
  LOOP
    SELECT cp.cand_id, cp.source, sum(cp.v_poi) mv, count(*) mn
    FROM staging.floc_cand_poi cp
    WHERE cp.poi_id NOT IN (SELECT poi_id FROM staging.floc_covered)
      AND cp.cand_id NOT IN (SELECT cand_id FROM staging.floc_greedy)
    GROUP BY cp.cand_id, cp.source
    ORDER BY sum(cp.v_poi) DESC, count(*) DESC
    LIMIT 1 INTO best;
    EXIT WHEN best IS NULL OR best.mn = 0 OR rg >= maxrang;
    rg := rg + 1; cum_v := cum_v + best.mv; cum_n := cum_n + best.mn;
    INSERT INTO staging.floc_covered
      SELECT DISTINCT poi_id FROM staging.floc_cand_poi
      WHERE cand_id = best.cand_id AND poi_id NOT IN (SELECT poi_id FROM staging.floc_covered);
    INSERT INTO staging.floc_greedy VALUES (rg, best.cand_id, best.source, round(best.mv::numeric,3), best.mn, round(cum_v::numeric,3), cum_n);
    IF rg % 10 = 0 THEN RAISE NOTICE 'greedy rang % : cum_v=% cum_npoi=%', rg, round(cum_v::numeric,1), cum_n; END IF;
  END LOOP;
  RAISE NOTICE 'greedy TERMINÉ à N=% (cum_v=% / %, cum_npoi=%)', rg, round(cum_v::numeric,1),
    (SELECT round(v_total::numeric,1) FROM staging.floc_univers), cum_n;
END $$;
COMMIT;

-- 3) Courbe valeur<->N (part de valeur captée + gain marginal % pour repérer le coude)
SELECT g.rang, g.source, round((g.cum_v/u.v_total*100)::numeric,1) AS pct_valeur_captee,
       round((g.marginal_v/u.v_total*100)::numeric,2) AS gain_marginal_pct, g.cum_npoi, g.marginal_npoi
FROM staging.floc_greedy g CROSS JOIN staging.floc_univers u
ORDER BY g.rang;
