-- 33b_ferry_euros.sql, coût ferry € estimé (riksregulativet, M097) sur la matrice + variante default.
-- R1 : tarif AutoPASS-regulativ AP2 (van 6-8 m) RÉEL par sone (mcda2.ferry_tarif_sone) ; sone ESTIMÉE par distance de
-- traversée (sone ≈ ceil(km), flaggé « non vérifié per-samband »). Ristourne AutoPASS = param réglable. Par TRAVERSÉE
-- DISTINCTE (regroupement samband), pas par segment. cout_ferry_source posé pour la traçabilité.
-- Usage : PGOPTIONS="-c client_min_messages=warning -c extra_float_digits=3" psql -h localhost -p 5433 -d norvege_routing -v ON_ERROR_STOP=1 -f calc/recette/33b_ferry_euros.sql

\set ON_ERROR_STOP on

-- Params.
CREATE TEMP TABLE _fp AS SELECT
 (SELECT valeur FROM mcda2.routing_params WHERE profil='couts' AND param='taux_nok_eur') AS taux,
 (SELECT valeur FROM mcda2.routing_params WHERE profil='couts' AND param='ferry_ristourne_pct') AS rist;

-- 1. Tarif par SAMBAND : distance totale de traversée → sone (≈ceil km) → prix AP2 → € (ristourne + change).
DROP TABLE IF EXISTS mcda2.ferry_samband_tarif;
CREATE TABLE mcda2.ferry_samband_tarif AS
WITH s AS (
  SELECT streetname AS samband, sum(km) AS km_traversee
  FROM staging.nvdb_ferry_link GROUP BY streetname
)
SELECT s.samband, round(s.km_traversee::numeric,2) AS km,
  least(greatest(ceil(s.km_traversee)::int,1),113) AS sone,
  t.prix_nok_ap2 AS prix_nok,
  round((t.prix_nok_ap2 * (SELECT taux FROM _fp) * (1 - (SELECT rist FROM _fp)/100.0))::numeric,2) AS prix_eur,
  'estimé riksregulativet AP2, sone≈ceil(km), non vérifié per-samband' AS source
FROM s JOIN mcda2.ferry_tarif_sone t ON t.sone = least(greatest(ceil(s.km_traversee)::int,1),113);
CREATE INDEX ON mcda2.ferry_samband_tarif(samband);

-- 2. Enrichir les arêtes ferry Ruteplan : samband (plus proche NVDB) + € par arête = prix samband / nb segments.
ALTER TABLE staging.ways_ruteplan DROP COLUMN IF EXISTS samband;
ALTER TABLE staging.ways_ruteplan DROP COLUMN IF EXISTS ferry_eur;
ALTER TABLE staging.ways_ruteplan ADD COLUMN samband text;
ALTER TABLE staging.ways_ruteplan ADD COLUMN ferry_eur numeric DEFAULT 0;
UPDATE staging.ways_ruteplan w SET samband = (
  SELECT streetname FROM staging.nvdb_ferry_25833 n
  ORDER BY n.geom <-> ST_LineInterpolatePoint(w.geom,0.5) LIMIT 1)
WHERE w.is_ferry;
-- € par arête = prix du samband / nombre d'arêtes ferry de ce samband (somme sur un chemin = prix samband complet).
WITH nseg AS (SELECT samband, count(*) n FROM staging.ways_ruteplan WHERE is_ferry AND samband IS NOT NULL GROUP BY samband)
UPDATE staging.ways_ruteplan w SET ferry_eur = round((t.prix_eur / nseg.n)::numeric,4)
FROM mcda2.ferry_samband_tarif t JOIN nseg ON nseg.samband=t.samband
WHERE w.is_ferry AND w.samband = t.samband;

\echo '== samband tarifés (sone/prix) =='
SELECT count(*) sambands, round(avg(prix_eur)::numeric,2) eur_moy, round(min(prix_eur)::numeric,2) mn, round(max(prix_eur)::numeric,2) mx,
       count(*) FILTER (WHERE (SELECT rist FROM _fp)=0) note_plein_tarif FROM mcda2.ferry_samband_tarif;
\echo '== arêtes ferry sans samband apparié (attendu 0) =='
SELECT count(*) FROM staging.ways_ruteplan WHERE is_ferry AND samband IS NULL;

-- 3. Re-trace : par paire, € ferry (somme arêtes) + n_traversées distinctes (samband distincts).
DROP TABLE IF EXISTS staging.ferry_eur_par_paire;
CREATE TABLE staging.ferry_eur_par_paire(source_base int, target_base int, cout_ferry_eur numeric, n_traversees int);
DO $$
DECLARE b RECORD;
BEGIN
  FOR b IN SELECT brn.base_id, brn.node_ruteplan FROM staging.base_ruteplan_node brn ORDER BY brn.base_id LOOP
    INSERT INTO staging.ferry_eur_par_paire
    SELECT b.base_id, nb.base_id,
      round(coalesce(sum(w.ferry_eur),0)::numeric,2),
      count(DISTINCT w.samband) FILTER (WHERE w.is_ferry)
    FROM pgr_dijkstra(
      'SELECT id, source, target, cost_s AS cost, reverse_cost_s AS reverse_cost FROM staging.ways_ruteplan',
      b.node_ruteplan,
      ARRAY(SELECT node_ruteplan FROM staging.base_ruteplan_node WHERE base_id<>b.base_id), directed:=true) d
    JOIN staging.ways_ruteplan w ON w.id=d.edge AND d.edge<>-1
    JOIN staging.base_ruteplan_node nb ON nb.node_ruteplan=d.end_vid
    GROUP BY nb.base_id;
  END LOOP;
END $$;
CREATE INDEX ON staging.ferry_eur_par_paire(source_base,target_base);

-- 4. Appliquer sur la matrice live + variante default + total. cout_ferry_source posé.
ALTER TABLE mcda2.matrice_base_base ADD COLUMN IF NOT EXISTS n_traversees int;
ALTER TABLE mcda2.matrice_base_base ADD COLUMN IF NOT EXISTS cout_ferry_source text;
UPDATE mcda2.matrice_base_base m SET
  cout_ferry_eur = f.cout_ferry_eur, n_traversees = f.n_traversees,
  cout_ferry_source = CASE WHEN f.cout_ferry_eur>0 THEN 'estimé riksregulativet AP2 (sone≈km), ristourne param' ELSE NULL END
FROM staging.ferry_eur_par_paire f WHERE f.source_base=m.source_base AND f.target_base=m.target_base;
UPDATE mcda2.matrice_base_base SET cout_eur_total = round((coalesce(cout_carburant_eur,0)+coalesce(cout_peage_eur,0)+coalesce(cout_ferry_eur,0))::numeric,2) WHERE source_base<>target_base;

UPDATE mcda2.variante_liaison v SET cout_ferry_eur = f.cout_ferry_eur
FROM staging.ferry_eur_par_paire f WHERE v.mode='default' AND f.source_base=v.source_base AND f.target_base=v.target_base;
UPDATE mcda2.variante_liaison SET cout_total_eur = round((coalesce(cout_carburant_eur,0)+coalesce(cout_peage_eur,0)+coalesce(cout_ferry_eur,0))::numeric,2) WHERE mode='default';

\echo '== couverture ferry € (paires ferry) + moyenne =='
SELECT count(*) FILTER (WHERE cout_ferry_eur>0) paires_ferry_eur, round(avg(cout_ferry_eur) FILTER (WHERE cout_ferry_eur>0)::numeric,2) eur_moy,
       max(n_traversees) max_traversees, round(max(cout_ferry_eur)::numeric,2) eur_max
FROM mcda2.matrice_base_base WHERE source_base<>target_base;
\echo '== exemple 1->5 (temps, €, traversées) =='
SELECT source_base,target_base,(minutes_roulage+minutes_ferry) min_tot, cout_carburant_eur carb, cout_peage_eur peage, cout_ferry_eur ferry, n_traversees, cout_eur_total FROM mcda2.matrice_base_base WHERE source_base=1 AND target_base=5;
