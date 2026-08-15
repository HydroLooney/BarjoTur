-- Facility-loc v3 (M370/M414/M415) : matrice reachability, UN nœud POI par appel psql.
-- Checkpoint RÉEL : chaque appel psql = 1 transaction autocommit (pas de COMMIT interne nécessaire) →
-- floc_reach + floc_reach_progress se remplissent nœud par nœud, reprise sur (NOT IN progress), nœud lent isolé.
-- Piloté par une boucle shell externe (floc_run.sh). RAISE NOTICE 'ALLDONE' quand tout est fait.
DO $$
DECLARE pn bigint; g geometry; env geometry;
BEGIN
  -- ORDER BY random() : plusieurs runners parallèles piochent des nœuds différents (entrelace lents/rapides,
  -- évite que tous se ruent sur le même nœud lent). Collision rare protégée par ON CONFLICT + dédup aval.
  SELECT poi_node INTO pn FROM (
    SELECT poi_node FROM staging.floc_poi
    WHERE poi_node NOT IN (SELECT poi_node FROM staging.floc_reach_progress)
    ORDER BY random() LIMIT 1) x;
  IF pn IS NULL THEN RAISE NOTICE 'ALLDONE'; RETURN; END IF;
  SELECT geom INTO g FROM staging.van_node_giant WHERE node = pn;
  IF g IS NULL THEN
    INSERT INTO staging.floc_reach_progress(poi_node, n_pairs) VALUES (pn, -1) ON CONFLICT (poi_node) DO NOTHING;
    RETURN;
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
    VALUES (pn, (SELECT count(*) FROM staging.floc_reach WHERE poi_node = pn)) ON CONFLICT (poi_node) DO NOTHING;
  RAISE NOTICE 'node % done (% cand)', pn, (SELECT count(*) FROM staging.floc_reach WHERE poi_node = pn);
END $$;
