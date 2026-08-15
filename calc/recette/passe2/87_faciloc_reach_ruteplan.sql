-- 87_faciloc_reach_ruteplan.sql (M470 (d)) — SETUP + UNE cible POI par appel : matrice reachability candidat->POI <=90min sur ways_ruteplan.
-- Corrige le facility-loc (M430 était sur ways_van sans vrais ferries). Reversed graph drivingDistance depuis chaque nœud POI on-réseau,
-- bbox 140 km, garde les candidats (bases 165 ∪ van_ok 1154) atteignables <=5400 s. POI hors-réseau (snap>2km : Svalbard/îles) EXCLUS (résidu R1).
-- ROBUSTE (patron corrigé) : garde par COMPTAGE (jamais l'erreur \gset 0-ligne) ; NOT IN progress + ON CONFLICT (dédup). 1 nœud/appel = checkpoint.
-- Setup idempotent (CREATE IF NOT EXISTS) puis traite 1 nœud. Runner : while :; do psql ... -f 87_faciloc_reach_ruteplan.sql 2>&1 | grep -q ALLDONE && break; done
\set ON_ERROR_STOP on
CREATE TABLE IF NOT EXISTS staging.floc_reach_rutepl (
  poi_id integer, poi_node bigint, cand_node bigint, t_s double precision,
  PRIMARY KEY (poi_node, cand_node)
);
CREATE TABLE IF NOT EXISTS staging.floc_reach_rutepl_progress (poi_node bigint PRIMARY KEY, n_cand integer, done_at timestamptz DEFAULT now());

SELECT (count(*)=0) AS done FROM (
  SELECT DISTINCT poi_node FROM staging.floc_poi_rutepl WHERE NOT off_reseau
) x WHERE NOT EXISTS (SELECT 1 FROM staging.floc_reach_rutepl_progress p WHERE p.poi_node=x.poi_node) \gset
\if :done
  \echo ALLDONE
\else
  BEGIN;
  CREATE TEMP TABLE _pn ON COMMIT DROP AS
    SELECT x.poi_node
    FROM (SELECT DISTINCT poi_node FROM staging.floc_poi_rutepl WHERE NOT off_reseau) x
    WHERE NOT EXISTS (SELECT 1 FROM staging.floc_reach_rutepl_progress p WHERE p.poi_node=x.poi_node)
    ORDER BY random() LIMIT 1;

  -- Reachability candidat->POI = dijkstra one-to-many depuis le POI sur le GRAPHE INVERSÉ (target->source) vers les 1234 nœuds
  -- candidats, coût réel <=5400 s. PAS de bbox / drivingDistance (le bbox 140km chargeait 933k arêtes = 10min/nœud). Patron base_base (~5s).
  CREATE TEMP TABLE _reach ON COMMIT DROP AS
    SELECT d.end_vid AS cand_node, max(d.agg_cost) AS t_s
    FROM _pn pn,
    LATERAL pgr_dijkstra(
      'SELECT id, target AS source, source AS target, cost_s AS cost, reverse_cost_s AS reverse_cost FROM staging.ways_ruteplan',
      pn.poi_node,
      (SELECT array_agg(node_ruteplan) FROM staging.floc_candidat_rutepl),
      directed := true) d
    GROUP BY d.end_vid
    HAVING max(d.agg_cost) <= 5400;

  INSERT INTO staging.floc_reach_rutepl (poi_id, poi_node, cand_node, t_s)
  SELECT fp.poi_id, pn.poi_node, r.cand_node, r.t_s
  FROM _reach r
  JOIN _pn pn ON true
  JOIN staging.floc_poi_rutepl fp ON fp.poi_node = pn.poi_node AND NOT fp.off_reseau
  ON CONFLICT (poi_node, cand_node) DO NOTHING;

  INSERT INTO staging.floc_reach_rutepl_progress (poi_node, n_cand)
  SELECT pn.poi_node, (SELECT count(*) FROM _reach) FROM _pn pn
  ON CONFLICT (poi_node) DO NOTHING;
  COMMIT;
  \echo ONE_DONE
\endif
