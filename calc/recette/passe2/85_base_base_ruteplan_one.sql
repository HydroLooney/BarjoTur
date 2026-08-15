-- 85_base_base_ruteplan_one.sql (M467 (a)) — UNE source base par appel psql sur le graphe CANONIQUE ways_ruteplan.
-- Boucle externe (M403), 1 transaction = 1 checkpoint, anti-collision FOR UPDATE SKIP LOCKED. Route/ferry temps séparés + coûts €.
-- ROBUSTE (corr. 18/08) : garde par COMPTAGE (count renvoie toujours 1 ligne → jamais l'erreur « \gset aucune ligne »)
--   + sélection de source en TEMP TABLE (0 ligne = no-op, jamais d'erreur en cas de race). L'ancien patron \gset+\if spinnait à l'infini.
-- Runner : while :; do psql -h localhost -p 5433 -d norvege_routing -f calc/recette/passe2/85_base_base_ruteplan_one.sql 2>&1 | grep -q ALLDONE && break; done
\set ON_ERROR_STOP on
SELECT (count(*)=0) AS done
FROM staging.base_ruteplan_node b
WHERE NOT EXISTS (SELECT 1 FROM staging.bbr_progress p WHERE p.src_base = b.base_id) \gset
\if :done
  \echo ALLDONE
\else
  BEGIN;
  CREATE TEMP TABLE _src ON COMMIT DROP AS
    SELECT base_id AS src, node_ruteplan AS srcnode
    FROM staging.base_ruteplan_node b
    WHERE NOT EXISTS (SELECT 1 FROM staging.bbr_progress p WHERE p.src_base = b.base_id)
    ORDER BY random() LIMIT 1 FOR UPDATE SKIP LOCKED;

  CREATE TEMP TABLE _dij ON COMMIT DROP AS
    SELECT d.end_vid, d.edge, d.path_seq, d.cost
    FROM _src s,
    LATERAL pgr_dijkstra(
        'SELECT id, source, target, cost_s AS cost, reverse_cost_s AS reverse_cost FROM staging.ways_ruteplan',
        s.srcnode,
        (SELECT array_agg(node_ruteplan) FROM staging.base_ruteplan_node WHERE base_id <> s.src),
        directed := true) d;

  CREATE TEMP TABLE _agg ON COMMIT DROP AS
    SELECT brn.base_id AS tgt_base,
           sum(d.cost) FILTER (WHERE w.is_ferry IS FALSE)                    AS conduite_s,
           coalesce(sum(d.cost) FILTER (WHERE w.is_ferry), 0)                AS ferry_s,
           coalesce(sum(w.length_m), 0)                                      AS length_m,
           count(*) FILTER (WHERE w.is_ferry)                                AS n_ferries,
           coalesce(bool_or(w.is_ferry), false)                             AS has_ferry,
           coalesce(sum(w.peage_eur) FILTER (WHERE w.is_ferry IS FALSE), 0)  AS peage_eur,
           coalesce(sum(w.ferry_eur) FILTER (WHERE w.is_ferry), 0)           AS ferry_eur,
           array_agg(d.edge ORDER BY d.path_seq) FILTER (WHERE d.edge <> -1) AS path,
           count(*) FILTER (WHERE d.edge <> -1)                              AS n_legs
    FROM _dij d
    LEFT JOIN staging.ways_ruteplan w ON w.id = d.edge
    JOIN staging.base_ruteplan_node brn ON brn.node_ruteplan = d.end_vid
    GROUP BY brn.base_id;

  INSERT INTO staging.bbr_route (src_base,tgt_base,conduite_s,ferry_s,length_m,n_ferries,has_ferry,peage_eur,ferry_eur)
  SELECT (SELECT src FROM _src), tgt_base, conduite_s, ferry_s, length_m, n_ferries, has_ferry, peage_eur, ferry_eur FROM _agg
  ON CONFLICT (src_base,tgt_base) DO NOTHING;

  INSERT INTO staging.bbr_path (src_base,tgt_base,path,n_legs)
  SELECT (SELECT src FROM _src), tgt_base, path, n_legs FROM _agg
  ON CONFLICT (src_base,tgt_base) DO NOTHING;

  INSERT INTO staging.bbr_progress (src_base,n_tgt)
  SELECT s.src, count(*) FROM _agg, _src s GROUP BY s.src
  ON CONFLICT (src_base) DO NOTHING;
  COMMIT;
  \echo ONE_DONE
\endif
