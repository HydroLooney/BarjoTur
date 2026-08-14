-- 32_recout_ferry.sql (tâche A-19, JOUÉ APRÈS le gate géom C16 = PASS, M020/M021/M023).
-- Recoûte les arêtes ferry synthétiques de ways_van (aujourd'hui ~20 km/h flat) selon le modèle sourcé M021 :
--   coût_traversée_min = 5 (accostage) + distance_reelle_km / 22 (croisière) × 60 + 20 (battement août)
-- Distance réelle = géométrie PostGIS de DB1 (pas les estimations vol d'oiseau des sources secondaires, R1 M021).
--
-- ways_van RESTE READ-ONLY (invariant plan v3) : on n'UPDATE PAS ways_van. Le recoûtage vit dans une table
-- d'OVERRIDE que le routage applique par COALESCE. Les artefacts vont dans ways_van_exclusions (déplacer, jamais rm).
--
-- SEUIL 35 km, PAS 15 km (correction R1 sur la prémisse M021). Vérifié en direct sur DB1 (13/08) :
--   * M021 pose « aucun car-ferry de la zone ne dépasse ~15 km, 23 artefacts >200 km ». FAUX dans les deux sens :
--     738 arêtes synthétiques, 136 mesurent >15 km (15 -> 583 km), pas 23.
--   * Test de connectivité (pgr_connectedComponents sur les 105 noeuds de bases) :
--       - graphe LIVE (moins exclusions) : 105 bases en 1 composante.
--       - retirer TOUS les synthétiques >15 km : 105 bases en 4 composantes -> 4 bases DÉTACHÉES
--         (13, 39, 61, 81) dont le SEUL lien est un ferry de 19 à 33,3 km (Hardanger lon~6,3 ; Trøndelag lon~9).
--       - retirer les >35 km / >50 km / >200 km : 105 bases en 1 composante (load-bearing max = 33,3 km, base 61).
--   * Conclusion : garder+recoûter <=35 km (vrais ferries courts + les 4 traversées porteuses 19-33 km),
--     purger >35 km (non load-bearing, longueurs implausibles 35 -> 583 km = artefacts a01/a02/a05).
--   * Les 4 traversées 19-33 km sont ESCALADÉES à M (A017) pour source-vérification des lignes réelles ;
--     tant que non tranché, on les garde (retrait = re-casse la connectivité ouest, régression du bug corrigé).
--
-- NON-CLOBBER : ce script ne reconstruit PAS la matrice live (empreinte a40a9922 chargée+gate-validée par B).
-- Override+exclusions = préparation DB1 de la matrice v-suivante (A-06), que M séquence. Étapes restantes après :
--   (1) recâbler 30_matrices/30b pour COALESCE l'override, (2) rebuild matrice vers table versionnée,
--   (3) contrôle connectivité 105 bases, (4) dump -> B pour une nouvelle convergence DB2.
--
-- Usage : psql -h localhost -p 5433 -d norvege_routing -v ON_ERROR_STOP=1 -f calc/recette/32_recout_ferry.sql

\set ON_ERROR_STOP on

-- Seuil de coupe (km) dérivé de la connectivité des bases (load-bearing max mesuré = 33,3 km).
\set seuil_purge_km 35

BEGIN;

-- 1. Override de coût des arêtes ferry synthétiques CONSERVÉES (distance réelle <= 35 km : ferries courts + porteuses).
--    Battement août = 20 min (haute saison, lignes majeures ; M021). Distance depuis la géométrie géodésique.
DROP TABLE IF EXISTS mcda2.ways_van_cout_override;
CREATE TABLE mcda2.ways_van_cout_override (
  edge_id    bigint PRIMARY KEY,
  km_reel    double precision NOT NULL,
  cost_s     double precision NOT NULL,
  modele     text DEFAULT 'M021 : 5min accostage + km_reel/22*60 + 20min battement aout (seuil garde <=35km, R1 connectivite)',
  calcule_le timestamptz DEFAULT now()
);
INSERT INTO mcda2.ways_van_cout_override (edge_id, km_reel, cost_s)
SELECT wv.id,
       ST_Length(wv.geom::geography)/1000.0 AS km_reel,
       ( 5.0                                                     -- accostage (min)
       + (ST_Length(wv.geom::geography)/1000.0) / 22.0 * 60.0    -- croisière 22 km/h, distance géodésique réelle
       + 20.0                                                    -- battement août (min)
       ) * 60.0                                                  -- -> secondes
FROM mcda2.ways_van wv
WHERE wv.id >= 900000000
  AND ST_Length(wv.geom::geography) <= (:seuil_purge_km * 1000.0);

-- 2. Artefacts (>35 km) : faux ferries non load-bearing (35 -> 583 km, scripts prototype a01/a02/a05).
--    Purge = exclusion (déplacer, jamais rm). ways_van reste read-only. Longueur tracée pour restauration éventuelle.
INSERT INTO mcda2.ways_van_exclusions (edge_id, raison, source)
SELECT wv.id,
       'Artefact ferry >35 km (' || round((ST_Length(wv.geom::geography)/1000)::numeric,1) || ' km) : non load-bearing, purge M021 seuil connectivite',
       'A-19 / M021 (seuil 35 km derive de la connectivite des 105 bases ; artefacts a01/a02/a05)'
FROM mcda2.ways_van wv
WHERE wv.id >= 900000000
  AND ST_Length(wv.geom::geography) > (:seuil_purge_km * 1000.0)
  AND NOT EXISTS (SELECT 1 FROM mcda2.ways_van_exclusions e WHERE e.edge_id = wv.id);

COMMIT;

-- Vérifications (verification-before-completion).
\echo '== Ferries conservés + recoûtés (<=35 km) =='
SELECT count(*) AS n_recoutees,
       round(min(km_reel)::numeric,1) km_min, round(max(km_reel)::numeric,1) km_max,
       round(min(cost_s/60)::numeric,1) cout_min_min, round(avg(cost_s/60)::numeric,1) cout_moy_min, round(max(cost_s/60)::numeric,1) cout_max_min
FROM mcda2.ways_van_cout_override;
\echo '== Artefacts >35 km purgés vers exclusions =='
SELECT count(*) FROM mcda2.ways_van_exclusions WHERE raison LIKE 'Artefact ferry >35 km%';
\echo '== PREUVE connectivité : 105 bases doivent rester en 1 composante APRÈS purge (exclusions appliquées) =='
SELECT count(DISTINCT cc.component) AS n_composantes_bases, count(*) AS n_bases
FROM mcda2.base_node_van b
JOIN (SELECT * FROM pgr_connectedComponents(
    'SELECT id, source, target, 1::float AS cost, 1::float AS reverse_cost
       FROM mcda2.ways_van
      WHERE id NOT IN (SELECT edge_id FROM mcda2.ways_van_exclusions)')) cc
  ON cc.node=b.node_van;
\echo '== Les 4 bases porteuses (13,39,61,81) restent-elles jointes ? (doit rester 1 composante commune au reste) =='
SELECT b.base_id, cc.component
FROM mcda2.base_node_van b
JOIN (SELECT * FROM pgr_connectedComponents(
    'SELECT id, source, target, 1::float AS cost, 1::float AS reverse_cost
       FROM mcda2.ways_van
      WHERE id NOT IN (SELECT edge_id FROM mcda2.ways_van_exclusions)')) cc
  ON cc.node=b.node_van
WHERE b.base_id IN (13,39,61,81) ORDER BY b.base_id;
\echo '== RAPPEL : override+exclusions posés (DB1). Reste (séquencé par M) : COALESCE dans 30_matrices, rebuild matrice v-suivante versionnée, dump -> B. NE PAS clobber la matrice live. =='
