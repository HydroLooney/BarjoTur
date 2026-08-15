-- 89_bases_ideales_rutepl_v31.sql (M501 + directives Guillaume 18/08) — MATÉRIALISE les bases idéales v3.1 sur le vrai graphe, EMPRISE 4 régions.
-- Directives Guillaume : EMPRISE = 4 grandes régions uniquement (POI hors-emprise + Svalbard exclus) ; FOND = ≥1 base/SOUS-ZONE (vivier 165,
--   parfois le « moins mauvais » candidat) ; FOCUS/RECOMMANDÉ = 30 (= 100% valeur). M501 : optimum coude = 18 (Coulisses).
-- Greedy SUR le vivier 165 (base_ruteplan_node) × POI IN-EMPRISE (562) → liste rangée = préfixe (une table sert optimum≤18 + recommandé≤30).
-- Pré-requis : staging.vivier_cand_poi_rutepl (vivier×poi in-emprise), staging.vivier (165), staging.poi_emprise. Idempotent.
\set ON_ERROR_STOP on
BEGIN;
-- univers vivier in-emprise (borne haute)
DROP TABLE IF EXISTS staging.vivier_univers_rutepl;
CREATE TABLE staging.vivier_univers_rutepl AS
SELECT count(*) n_poi, sum(v) v_total FROM (SELECT poi_id, max(v_poi) v FROM staging.vivier_cand_poi_rutepl GROUP BY poi_id) u;

-- GREEDY sur le vivier (identité = base_id)
DROP TABLE IF EXISTS staging.vivier_covered_rutepl; CREATE TABLE staging.vivier_covered_rutepl(poi_id int PRIMARY KEY);
DROP TABLE IF EXISTS staging.vivier_greedy_rutepl;  CREATE TABLE staging.vivier_greedy_rutepl(
  rang int, base_id int, marginal_v numeric, marginal_npoi int, cum_v numeric, cum_npoi int);
DO $$
DECLARE best record; cum_v numeric := 0; cum_n int := 0; rg int := 0;
BEGIN
  LOOP
    SELECT cp.base_id, sum(cp.v_poi) mv, count(*) mn
    FROM staging.vivier_cand_poi_rutepl cp
    WHERE cp.poi_id NOT IN (SELECT poi_id FROM staging.vivier_covered_rutepl)
      AND cp.base_id NOT IN (SELECT base_id FROM staging.vivier_greedy_rutepl)
    GROUP BY cp.base_id ORDER BY sum(cp.v_poi) DESC, count(*) DESC LIMIT 1 INTO best;
    EXIT WHEN best IS NULL OR best.mn = 0;
    rg := rg+1; cum_v := cum_v+best.mv; cum_n := cum_n+best.mn;
    INSERT INTO staging.vivier_covered_rutepl SELECT DISTINCT poi_id FROM staging.vivier_cand_poi_rutepl
      WHERE base_id=best.base_id AND poi_id NOT IN (SELECT poi_id FROM staging.vivier_covered_rutepl);
    INSERT INTO staging.vivier_greedy_rutepl VALUES (rg, best.base_id, round(best.mv::numeric,3), best.mn, round(cum_v::numeric,3), cum_n);
  END LOOP;
  RAISE NOTICE 'greedy vivier ruteplan N=% cum_v=%/% npoi=%', rg, round(cum_v::numeric,1),
    (SELECT round(v_total::numeric,1) FROM staging.vivier_univers_rutepl), cum_n;
END $$;

-- rayonnement par base (Σ v_poi in-emprise atteignable) + sous-zone
DROP TABLE IF EXISTS staging.bases_ideales_rutepl_v31;
CREATE TABLE staging.bases_ideales_rutepl_v31 AS
SELECT v.base_id, v.source, v.sous_zone_id,
       g.rang,
       (g.rang IS NOT NULL AND g.rang <= 18) AS est_optimum,      -- coude M501, précalc Coulisses
       (g.rang IS NOT NULL AND g.rang <= 30) AS est_recommande,   -- focus/illuminé (Guillaume 30 = 100%)
       coalesce(cv.val,0) AS rayonnement, coalesce(cv.npoi,0) AS rayonnement_npoi
FROM staging.vivier v
LEFT JOIN staging.vivier_greedy_rutepl g ON g.base_id = v.base_id
LEFT JOIN (SELECT base_id, sum(v_poi) val, count(distinct poi_id) npoi FROM staging.vivier_cand_poi_rutepl GROUP BY base_id) cv
       ON cv.base_id = v.base_id;
COMMENT ON TABLE staging.bases_ideales_rutepl_v31 IS
  'v3.1 (M501 + Guillaume 18/08) : bases idéales sur ways_ruteplan, EMPRISE 4 régions. FOND = vivier 165 (≥1/sous-zone) ; '
  'est_recommande = focus 30 (=100% valeur, Guillaume) ; est_optimum = 18 (coude, Coulisses M501). rayonnement = Σ v_poi in-emprise '
  'atteignable <=90min. Résidu R1 : 53 POI hors-réseau (Svalbard/îles exclus, pas de Svalbard - Guillaume) + 151 remote non atteignables '
  '+ POI hors-emprise 4 régions exclus. Greedy prefix (une table sert les 3 couches).';
COMMIT;

\echo '== courbe valeur<->N (vivier in-emprise) + couches =='
SELECT g.rang, round((g.cum_v/u.v_total*100)::numeric,1) pct_valeur, g.cum_npoi,
       CASE WHEN g.rang<=18 THEN 'optimum' WHEN g.rang<=30 THEN 'recommandé' ELSE 'vivier' END couche
FROM staging.vivier_greedy_rutepl g CROSS JOIN staging.vivier_univers_rutepl u
WHERE g.rang IN (5,10,15,18,20,25,28,30,35) OR g.rang=(SELECT max(rang) FROM staging.vivier_greedy_rutepl) ORDER BY g.rang;
\echo '== bilan bases_ideales_rutepl_v31 =='
SELECT count(*) fond_vivier, count(*) FILTER (WHERE est_recommande) recommandes_30, count(*) FILTER (WHERE est_optimum) optimum_18,
       count(*) FILTER (WHERE rang IS NULL) sans_apport_greedy, count(distinct sous_zone_id) sous_zones FROM staging.bases_ideales_rutepl_v31;
