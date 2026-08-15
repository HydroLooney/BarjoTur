-- Facility-loc v3 (M370) — matrice reachability candidat->POI, version CHUNKÉE + CHECKPOINT (M403).
-- Patron : lots de nœuds POI + COMMIT par lot + table de progression (reprise) + résultats intermédiaires exploitables.
-- FILET : à lancer UNIQUEMENT si le job mono-transaction (floc_reach_job.sql) échoue/coupe (sinon il re-traiterait tout).
-- Reprise : relancer ce même fichier reprend au dernier lot (les nœuds déjà dans floc_reach_progress sont sautés).
-- NE PAS exécuter dans un BEGIN explicite (le DO fait ses propres COMMIT).

CREATE TABLE IF NOT EXISTS staging.floc_reach_progress (
  poi_node bigint PRIMARY KEY,
  n_pairs  int,            -- nb candidats atteignant ce POI (-1 = nœud hors composante géante, sauté)
  done_at  timestamptz DEFAULT clock_timestamp()
);
-- (ré)initialisation douce de floc_reach seulement si on repart de zéro
DO $reset$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM staging.floc_reach_progress) THEN
    TRUNCATE staging.floc_reach;
  END IF;
END $reset$;

DO $$
DECLARE batch bigint[]; pn bigint; g geometry; env geometry; lot int := 0; tot int;
BEGIN
  SELECT count(DISTINCT poi_node) INTO tot FROM staging.floc_poi;
  LOOP
    -- prochain LOT de 25 nœuds POI non encore traités (checkpoint = floc_reach_progress)
    SELECT array_agg(poi_node) INTO batch FROM (
      SELECT DISTINCT fp.poi_node FROM staging.floc_poi fp
      WHERE fp.poi_node NOT IN (SELECT poi_node FROM staging.floc_reach_progress)
      LIMIT 10) b;
    EXIT WHEN batch IS NULL;
    FOREACH pn IN ARRAY batch LOOP
      SELECT geom INTO g FROM staging.van_node_giant WHERE node = pn;
      IF g IS NULL THEN
        INSERT INTO staging.floc_reach_progress(poi_node, n_pairs) VALUES (pn, -1)
          ON CONFLICT (poi_node) DO NOTHING;
        CONTINUE;
      END IF;
      env := ST_Envelope(ST_Buffer(g::geography, 140000)::geometry);
      INSERT INTO staging.floc_reach (poi_node, cand_node, t_s)
      SELECT pn, c.node_van, min(dd.agg_cost)
      FROM pgr_drivingDistance(
        format('SELECT id, target AS source, source AS target, cost_s AS cost, reverse_cost_s AS reverse_cost '
               'FROM mcda2.ways_van WHERE (cost_s>=0 OR reverse_cost_s>=0) AND geom && %L::geometry', env),
        pn, 5400, directed := true) dd
      JOIN staging.floc_candidat c ON c.node_van = dd.node
      GROUP BY c.node_van;
      INSERT INTO staging.floc_reach_progress(poi_node, n_pairs)
        VALUES (pn, (SELECT count(*) FROM staging.floc_reach WHERE poi_node = pn))
        ON CONFLICT (poi_node) DO NOTHING;
    END LOOP;
    COMMIT;   -- CHECKPOINT par lot : résultats intermédiaires commités + reprise possible
    lot := lot + 1;
    RAISE NOTICE 'lot % commité — % / % nœuds POI traités', lot,
      (SELECT count(*) FROM staging.floc_reach_progress), tot;
  END LOOP;
  RAISE NOTICE 'CHUNKED TERMINÉ : % nœuds POI, % paires',
    (SELECT count(*) FROM staging.floc_reach_progress), (SELECT count(*) FROM staging.floc_reach);
END $$;
CREATE INDEX IF NOT EXISTS floc_reach_poinode ON staging.floc_reach(poi_node);
CREATE INDEX IF NOT EXISTS floc_reach_candnode ON staging.floc_reach(cand_node);
