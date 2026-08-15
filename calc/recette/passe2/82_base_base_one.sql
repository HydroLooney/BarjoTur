-- 82_base_base_one.sql (M459 GO) — traite UNE source base par appel psql (= 1 transaction = checkpoint autocommit reprisable).
-- Pattern boucle externe (M403) : jamais de DO monolithique ; anti-collision runners via FOR UPDATE SKIP LOCKED sur la source.
-- Route one-to-many pgr_dijkstra sur ways_van (cost_s) → conduite_s/length_m/has_ferry + path/n_legs vers les 164 autres bases du vivier.
-- Reprise : la source déjà dans staging.bb_progress est ignorée. Fin : émet 'ALLDONE'.
-- Runner : while :; do psql -h localhost -p 5433 -d norvege_routing -f calc/recette/passe2/82_base_base_one.sql 2>&1 | grep -q ALLDONE && break; done
\set ON_ERROR_STOP on
BEGIN;
-- Réserve la prochaine source non traitée (verrou tenu jusqu'au COMMIT → les autres runners la sautent)
SELECT base_id AS src, node_van AS srcnode
FROM staging.vivier v
WHERE NOT EXISTS (SELECT 1 FROM staging.bb_progress p WHERE p.src_base = v.base_id)
ORDER BY random() LIMIT 1
FOR UPDATE SKIP LOCKED \gset
\if :{?src}
  CREATE TEMP TABLE _dij ON COMMIT DROP AS
  SELECT d.end_vid, d.edge, d.path_seq, d.agg_cost
  FROM pgr_dijkstra(
        'SELECT id, source, target, cost_s AS cost, reverse_cost_s AS reverse_cost FROM mcda2.ways_van',
        :srcnode,
        (SELECT array_agg(node_van) FROM staging.vivier WHERE base_id <> :src),
        directed := true) d;

  -- Agrégat par cible (nœud d'arrivée) → conduite_s/length_m/has_ferry + path
  CREATE TEMP TABLE _agg ON COMMIT DROP AS
  SELECT v.base_id AS tgt_base,
         max(d.agg_cost)                                             AS conduite_s,
         sum(w.length_m)                                             AS length_m,
         bool_or(w.est_ferry)                                        AS has_ferry,
         array_agg(d.edge ORDER BY d.path_seq) FILTER (WHERE d.edge <> -1) AS path,
         count(*) FILTER (WHERE d.edge <> -1)                        AS n_legs
  FROM _dij d
  LEFT JOIN mcda2.ways_van w ON w.id = d.edge
  JOIN staging.vivier v ON v.node_van = d.end_vid
  GROUP BY v.base_id;

  INSERT INTO staging.bb_route (src_base, tgt_base, conduite_s, length_m, has_ferry)
  SELECT :src, tgt_base, conduite_s, length_m, has_ferry FROM _agg
  ON CONFLICT (src_base, tgt_base) DO NOTHING;

  INSERT INTO staging.bb_path (src_base, tgt_base, path, n_legs)
  SELECT :src, tgt_base, path, n_legs FROM _agg
  ON CONFLICT (src_base, tgt_base) DO NOTHING;

  INSERT INTO staging.bb_progress (src_base, n_tgt)
  SELECT :src, count(*) FROM _agg
  ON CONFLICT (src_base) DO NOTHING;
  \echo ONE_DONE
\else
  \echo ALLDONE
\endif
COMMIT;
