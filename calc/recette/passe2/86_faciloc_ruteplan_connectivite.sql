-- 86_faciloc_ruteplan_connectivite.sql (M470 (d)) — FONDATION facility-loc v3.1 sur le graphe CANONIQUE ways_ruteplan.
-- Connectivité (composantes) du vrai graphe (vrais ferries → les îles côtières rejoignent la géante que ways_van isolait).
-- Un seul appel pgr_connectedComponents (atomique, non chunkable). Sert au van_ok (aménités snappées sur la géante).
-- Staging, non destructif. Usage : psql -h localhost -p 5433 -d norvege_routing -v ON_ERROR_STOP=1 -f calc/recette/passe2/86_faciloc_ruteplan_connectivite.sql
\set ON_ERROR_STOP on
DROP TABLE IF EXISTS staging.ruteplan_cc;
CREATE TABLE staging.ruteplan_cc AS
SELECT component, node
FROM pgr_connectedComponents(
  'SELECT id, source, target, cost_s AS cost, reverse_cost_s AS reverse_cost FROM staging.ways_ruteplan WHERE cost_s>=0 OR reverse_cost_s>=0');
CREATE INDEX ON staging.ruteplan_cc(node);
CREATE INDEX ON staging.ruteplan_cc(component);

\echo '== composante géante ways_ruteplan =='
SELECT component, count(*) n_nodes,
       round(100.0*count(*)/sum(count(*)) OVER (),2) pct
FROM staging.ruteplan_cc GROUP BY component ORDER BY n_nodes DESC LIMIT 3;
