-- 91_pieton_snap_poi_node.sql — SNAP POI→node piéton sur le réseau ways_pieton_v31 (fondation reach last-leg + wire transit).
-- Node space = ruteplan (fromnode/tonode), PARTAGÉ pied/van. ⚠ NE PAS confondre avec poi_van_node.node_van (espace van contracté ≠).
-- Produit : staging.pieton_node (nodes du graphe pied + composante + geom) ; staging.poi_pieton_node (POI in-emprise → node pied le plus
--   proche + snap_m + composante). POI = points ET lignes (poi.poi 4326) → snap via <-> sur ST_Transform(geom,25833). Idempotent. Read-only sur poi.poi.
\set ON_ERROR_STOP on
\timing on
BEGIN;

-- nodes du graphe pied (composante depuis ways_pieton_cc, geom depuis ruteplan_node partagé)
DROP TABLE IF EXISTS staging.pieton_node;
CREATE TABLE staging.pieton_node AS
SELECT cc.node, cc.component, rn.geom
FROM staging.ways_pieton_cc cc
JOIN staging.ruteplan_node rn ON rn.node = cc.node;
ALTER TABLE staging.pieton_node ADD PRIMARY KEY (node);
CREATE INDEX ix_pieton_node_geom ON staging.pieton_node USING gist (geom);
CREATE INDEX ix_pieton_node_comp ON staging.pieton_node (component);
ANALYZE staging.pieton_node;

-- POI in-emprise → node pied le plus proche (KNN <->, GiST)
DROP TABLE IF EXISTS staging.poi_pieton_node;
CREATE TABLE staging.poi_pieton_node AS
SELECT pe.poi_id, pe.sous_zone_id, nn.node AS pied_node, nn.component,
       round(nn.d::numeric, 1) AS snap_m
FROM staging.poi_emprise pe
JOIN poi.poi p ON p.poi_id = pe.poi_id AND p.geom IS NOT NULL
CROSS JOIN LATERAL (
  SELECT pn.node, pn.component, pn.geom <-> ST_Transform(p.geom, 25833) AS d
  FROM staging.pieton_node pn
  ORDER BY pn.geom <-> ST_Transform(p.geom, 25833)
  LIMIT 1
) nn;
ALTER TABLE staging.poi_pieton_node ADD PRIMARY KEY (poi_id);
ANALYZE staging.poi_pieton_node;

DO $$
DECLARE n_poi int; snap_med numeric; snap_p90 numeric; loin int;
BEGIN
  SELECT count(*), percentile_cont(0.5) WITHIN GROUP (ORDER BY snap_m),
         percentile_cont(0.9) WITHIN GROUP (ORDER BY snap_m), count(*) FILTER (WHERE snap_m > 1000)
    INTO n_poi, snap_med, snap_p90, loin FROM staging.poi_pieton_node;
  RAISE NOTICE 'poi_pieton_node : % POI snappés | snap médian % m / p90 % m | % POI à >1km d''un node pied',
    n_poi, round(snap_med,0), round(snap_p90,0), loin;
END $$;

COMMIT;
