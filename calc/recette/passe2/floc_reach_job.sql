-- Facility-loc v3 (M370) : matrice reachability candidat -> POI (<=90 min)
-- Méthode : pour chaque nœud POI (553), pgr_drivingDistance sur le graphe RETOURNÉ (swap source/target)
-- borné à un bbox géographique (buffer 140 km, tractable), filtré aux 1109 nœuds candidats.
-- agg_cost = coût réel candidat -> POI (secondes). Résultat -> staging.floc_reach.
TRUNCATE staging.floc_reach;
DO $$
DECLARE r record; env geometry; i int := 0; nins bigint;
BEGIN
  FOR r IN
    SELECT fp.poi_node, g.geom
    FROM (SELECT DISTINCT poi_node FROM staging.floc_poi) fp
    LEFT JOIN staging.van_node_giant g ON g.node = fp.poi_node
  LOOP
    i := i + 1;
    IF r.geom IS NULL THEN CONTINUE; END IF;  -- nœud POI hors composante géante : ignoré (loggé plus bas)
    env := ST_Envelope(ST_Buffer(r.geom::geography, 140000)::geometry);
    INSERT INTO staging.floc_reach (poi_node, cand_node, t_s)
    SELECT r.poi_node, c.node_van, min(dd.agg_cost)
    FROM pgr_drivingDistance(
      format('SELECT id, target AS source, source AS target, cost_s AS cost, reverse_cost_s AS reverse_cost '
             'FROM mcda2.ways_van WHERE (cost_s>=0 OR reverse_cost_s>=0) AND geom && %L::geometry',
             env),
      r.poi_node, 5400, directed := true) dd
    JOIN staging.floc_candidat c ON c.node_van = dd.node
    GROUP BY c.node_van;
    IF i % 50 = 0 THEN RAISE NOTICE 'floc_reach: % / 553 nœuds POI traités', i; END IF;
  END LOOP;
  GET DIAGNOSTICS nins = ROW_COUNT;
  RAISE NOTICE 'floc_reach TERMINÉ : % itérations', i;
END $$;
CREATE INDEX IF NOT EXISTS floc_reach_poinode ON staging.floc_reach(poi_node);
CREATE INDEX IF NOT EXISTS floc_reach_candnode ON staging.floc_reach(cand_node);
-- Bilan
SELECT count(*) AS paires, count(DISTINCT poi_node) AS poi_nodes_couverts, count(DISTINCT cand_node) AS cand_nodes_actifs
FROM staging.floc_reach;
