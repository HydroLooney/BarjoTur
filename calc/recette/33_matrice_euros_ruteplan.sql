-- 33_matrice_euros_ruteplan.sql, couche € ADDITIVE sur staging.matrice_ruteplan (graphe Ruteplan, M073/M087).
-- N'altère PAS les colonnes temps/km/ferry (empreinte 6aa9ac6c préservée) : ajoute carburant + péage + ferry(NULL).
--   carburant_eur = km × conso_l_100km/100 × prix_carburant_eur_l          (params single-source routing_params, T045)
--   peage_eur     = Σ takst_liten (NOK→EUR) des postes NVDB traversés sur le chemin (re-trace léger)
--   ferry_eur     = NULL (tarifs AutoPASS à sourcer per-samband — R1, pas d'invention)
-- Simplification R1 documentée : péage compté à chaque poste traversé, sans distinguer le sens (retning) ; peut
-- surcompter les postes unidirectionnels. Raffinement directionnel ultérieur.
-- Usage : PGOPTIONS="-c client_min_messages=warning" psql -h localhost -p 5433 -d norvege_routing -v ON_ERROR_STOP=1 -f calc/recette/33_matrice_euros_ruteplan.sql

\set ON_ERROR_STOP on

-- 0. Taux de change documenté (défaut réglable, flag R1) dans routing_params.
INSERT INTO mcda2.routing_params(profil, param, valeur, unite, description)
SELECT 'couts', 'taux_nok_eur', 0.086, 'EUR/NOK', 'Taux de change défaut documenté 2026 (~11,6 NOK/EUR) — à confirmer'
WHERE NOT EXISTS (SELECT 1 FROM mcda2.routing_params WHERE profil='couts' AND param='taux_nok_eur');

-- 1. Péage par arête routière : poste NVDB le plus proche du lien (<50 m, en 25833).
ALTER TABLE staging.ways_ruteplan DROP COLUMN IF EXISTS peage_eur;
ALTER TABLE staging.ways_ruteplan ADD COLUMN peage_eur numeric DEFAULT 0;
WITH taux AS (SELECT valeur AS t FROM mcda2.routing_params WHERE profil='couts' AND param='taux_nok_eur'),
     match AS (
       SELECT DISTINCT ON (t.nvdb_id) t.nvdb_id, w.id AS edge_id, t.takst_liten_nok
       FROM staging.nvdb_toll t
       CROSS JOIN LATERAL (
         SELECT id, geom FROM staging.ways_ruteplan
         WHERE NOT is_ferry
         ORDER BY geom <-> ST_Transform(t.geom, 25833)
         LIMIT 1
       ) w
       WHERE ST_DWithin(w.geom, ST_Transform(t.geom, 25833), 50)
     ),
     par_edge AS (
       SELECT edge_id, sum(takst_liten_nok) * (SELECT t FROM taux) AS peage_eur
       FROM match GROUP BY edge_id
     )
UPDATE staging.ways_ruteplan w SET peage_eur = p.peage_eur FROM par_edge p WHERE w.id = p.edge_id;

\echo '== postes NVDB appariés à un lien (<50 m) =='
SELECT (SELECT count(*) FROM staging.nvdb_toll) postes_total,
       count(*) FILTER (WHERE peage_eur>0) liens_avec_peage,
       round(sum(peage_eur)::numeric,2) peage_total_eur
FROM staging.ways_ruteplan WHERE NOT is_ferry;

-- 2. Colonnes € sur la matrice (additif).
ALTER TABLE staging.matrice_ruteplan DROP COLUMN IF EXISTS cout_carburant_eur;
ALTER TABLE staging.matrice_ruteplan DROP COLUMN IF EXISTS cout_peage_eur;
ALTER TABLE staging.matrice_ruteplan DROP COLUMN IF EXISTS cout_ferry_eur;
ALTER TABLE staging.matrice_ruteplan DROP COLUMN IF EXISTS cout_eur_total;
ALTER TABLE staging.matrice_ruteplan ADD COLUMN cout_carburant_eur numeric;
ALTER TABLE staging.matrice_ruteplan ADD COLUMN cout_peage_eur numeric;
ALTER TABLE staging.matrice_ruteplan ADD COLUMN cout_ferry_eur numeric;
ALTER TABLE staging.matrice_ruteplan ADD COLUMN cout_eur_total numeric;

-- 3. Carburant = colonne (km × params), pas de re-trace.
WITH p AS (
  SELECT (SELECT valeur FROM mcda2.routing_params WHERE profil='van' AND param='conso_l_100km') AS conso,
         (SELECT valeur FROM mcda2.routing_params WHERE profil='van' AND param='prix_carburant_eur_l') AS prix
)
UPDATE staging.matrice_ruteplan m
SET cout_carburant_eur = round((m.km * (SELECT conso FROM p)/100.0 * (SELECT prix FROM p))::numeric, 2);

-- 4. Péage par paire : re-trace léger (dijkstra one-to-many), somme peage_eur des liens traversés.
DROP TABLE IF EXISTS staging.peage_par_paire;
CREATE TABLE staging.peage_par_paire (source_base int, target_base int, peage_eur numeric);
DO $$
DECLARE b RECORD;
BEGIN
  FOR b IN SELECT brn.base_id, brn.node_ruteplan FROM staging.base_ruteplan_node brn ORDER BY brn.base_id LOOP
    INSERT INTO staging.peage_par_paire
    SELECT b.base_id, nb.base_id, round(coalesce(sum(w.peage_eur),0)::numeric,2)
    FROM pgr_dijkstra(
      'SELECT id, source, target, cost_s AS cost, reverse_cost_s AS reverse_cost FROM staging.ways_ruteplan',
      b.node_ruteplan,
      ARRAY(SELECT node_ruteplan FROM staging.base_ruteplan_node WHERE base_id <> b.base_id),
      directed := true) d
    JOIN staging.ways_ruteplan w ON w.id = d.edge AND d.edge <> -1
    JOIN staging.base_ruteplan_node nb ON nb.node_ruteplan = d.end_vid
    GROUP BY nb.base_id;
  END LOOP;
END $$;
CREATE INDEX ON staging.peage_par_paire(source_base, target_base);

UPDATE staging.matrice_ruteplan m SET cout_peage_eur = p.peage_eur
FROM staging.peage_par_paire p WHERE p.source_base=m.source_base AND p.target_base=m.target_base;

-- 5. Ferry € = NULL (AutoPASS à sourcer). Total = carburant + péage (+ ferry quand dispo).
UPDATE staging.matrice_ruteplan
SET cout_eur_total = round((coalesce(cout_carburant_eur,0) + coalesce(cout_peage_eur,0) + coalesce(cout_ferry_eur,0))::numeric,2);

-- 6. Vérifications € (sanity).
\echo '== A. Couverture € (carburant partout, péage sur combien) =='
SELECT count(*) FILTER (WHERE cout_carburant_eur IS NOT NULL) carb_ok,
       count(*) FILTER (WHERE cout_peage_eur>0) paires_avec_peage,
       round(avg(cout_carburant_eur)::numeric,1) carb_moy,
       round(avg(cout_peage_eur) FILTER (WHERE cout_peage_eur>0)::numeric,2) peage_moy_si_peage,
       round(max(cout_peage_eur)::numeric,2) peage_max
FROM staging.matrice_ruteplan WHERE source_base<>target_base;
\echo '== B. Exemple : 5 paires (temps, km, €) =='
SELECT source_base, target_base, (minutes_roulage+minutes_ferry) min_tot, km, cout_carburant_eur, cout_peage_eur, cout_eur_total
FROM staging.matrice_ruteplan WHERE source_base=1 AND target_base BETWEEN 2 AND 6 ORDER BY target_base;
