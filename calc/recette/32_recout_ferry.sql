-- 32_recout_ferry.sql (tâche A-19, PRÉPARÉ — à JOUER APRÈS le gate géom C16, M020/M021).
-- Recoûte les arêtes ferry synthétiques de ways_van (aujourd'hui ~20 km/h flat) selon le modèle sourcé M021 :
--   coût_traversée_min = 5 (accostage) + distance_reelle_km / 22 (croisière) × 60 + battement (août = 20 min)
-- Distance réelle = géométrie PostGIS de DB1 (pas les estimations vol d'oiseau des sources secondaires, R1 M021).
--
-- ways_van RESTE READ-ONLY (invariant plan v3) : on n'UPDATE PAS ways_van. Le recoûtage vit dans une table
-- d'OVERRIDE que le routage applique par COALESCE. Les artefacts (>15 km : aucun car-ferry de la zone ne
-- dépasse ~15 km, M021) vont dans ways_van_exclusions (purge, jamais recoûtés).
--
-- ⚠ NON APPLIQUÉ tant que le gate géom C16 n'est pas passé (recomputer la matrice la ferait diverger de
-- l'empreinte a40a9922 que B a chargée et gate-validée). À l'exécution : (1) jouer ce script, (2) recâbler
-- 30_matrices/30b pour COALESCE l'override, (3) rebuild matrice, (4) contrôle connectivité (105 bases
-- toujours joignables), (5) nouveau dump → B.
--
-- Usage (A-19, post-gate) : psql -h localhost -p 5433 -d norvege_routing -v ON_ERROR_STOP=1 -f calc/recette/32_recout_ferry.sql

\set ON_ERROR_STOP on
BEGIN;

-- 1. Override de coût des arêtes ferry synthétiques VALIDES (distance réelle <= 15 km).
--    Battement août = 20 min (haute saison, lignes majeures ; M021). Distance depuis la géométrie.
DROP TABLE IF EXISTS mcda2.ways_van_cout_override;
CREATE TABLE mcda2.ways_van_cout_override (
  edge_id    bigint PRIMARY KEY,
  cost_s     double precision NOT NULL,
  modele     text DEFAULT 'M021 : 5min accostage + dist_km/22*60 + 20min battement aout',
  calcule_le timestamptz DEFAULT now()
);
INSERT INTO mcda2.ways_van_cout_override (edge_id, cost_s)
SELECT wv.id,
       ( 5.0                                           -- accostage (min)
       + (ST_Length(wv.geom::geography)/1000.0) / 22.0 * 60.0   -- croisière 22 km/h, distance géodésique réelle
       + 20.0                                          -- battement août (min)
       ) * 60.0                                        -- -> secondes
FROM mcda2.ways_van wv
WHERE wv.id >= 900000000
  AND ST_Length(wv.geom::geography) <= 15000;          -- ferries réels <= 15 km (M021)

-- 2. Artefacts (>15 km) : arêtes non-ferry aberrantes (267-583 km = faux ferries des scripts a01/a02/a05).
--    Purge = exclusion (déplacer, jamais rm). ways_van reste read-only.
INSERT INTO mcda2.ways_van_exclusions (edge_id, raison, source)
SELECT wv.id,
       'Artefact ferry >15 km (' || round((ST_Length(wv.geom::geography)/1000)::numeric) || ' km) : aucun car-ferry réel, purge M021',
       'M021 (règle dure : borne quai-à-quai <=15 km ; artefacts a01/a02/a05)'
FROM mcda2.ways_van wv
WHERE wv.id >= 900000000
  AND ST_Length(wv.geom::geography) > 15000
  AND NOT EXISTS (SELECT 1 FROM mcda2.ways_van_exclusions e WHERE e.edge_id = wv.id);

COMMIT;

-- Vérifications (verification-before-completion).
\echo '== Override posé (ferries <=15 km recoûtés) =='
SELECT count(*) AS n_recoutees, round(min(cost_s/60)::numeric,1) min_min, round(avg(cost_s/60)::numeric,1) avg_min, round(max(cost_s/60)::numeric,1) max_min FROM mcda2.ways_van_cout_override;
\echo '== Artefacts >15 km purgés vers exclusions =='
SELECT count(*) FROM mcda2.ways_van_exclusions WHERE raison LIKE 'Artefact ferry%';
\echo '== RAPPEL : recâbler 30_matrices/30b (COALESCE override), rebuild, contrôle connectivité 105 bases, nouveau dump B. =='
