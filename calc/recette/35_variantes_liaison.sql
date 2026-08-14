-- 35_variantes_liaison.sql, variantes de liaison base-à-base (arbitrage temps↔argent, M073/M090/M094).
-- 3 modes dans mcda2.variante_liaison : 'default' (matrice promue), 'sans_ferry' (évite les bacs), 'sans_peage' (évite
-- les postes). Chaque mode : temps, km, € (carburant km×params, péage réel, ferry 0 si sans_ferry sinon NULL/AutoPASS).
-- Sert au composeur (B) : payer un ferry/péage pour gagner du temps, ou détourner gratis. Remplit aussi ferry_obligatoire
-- (îles injoignables sans ferry) + roulage_detour_min/km_detour/detour_possible sur la matrice.
-- NON destructif hors matrice déjà promue (colonnes variantes NULL → renseignées). Réversible.
-- Usage : PGOPTIONS="-c client_min_messages=warning -c extra_float_digits=3" psql -h localhost -p 5433 -d norvege_routing -v ON_ERROR_STOP=1 -f calc/recette/35_variantes_liaison.sql

\set ON_ERROR_STOP on

DROP TABLE IF EXISTS mcda2.variante_liaison;
CREATE TABLE mcda2.variante_liaison(
  source_base int, target_base int, mode text,
  temps_min numeric, km numeric,
  cout_carburant_eur numeric, cout_peage_eur numeric, cout_ferry_eur numeric, cout_total_eur numeric,
  n_ferries int, joignable boolean DEFAULT true
);

-- Params carburant (single-source).
CREATE TEMP TABLE _p AS SELECT
 (SELECT valeur FROM mcda2.routing_params WHERE profil='van' AND param='conso_l_100km') AS conso,
 (SELECT valeur FROM mcda2.routing_params WHERE profil='van' AND param='prix_carburant_eur_l') AS prix;

-- Mode 'default' = matrice promue.
INSERT INTO mcda2.variante_liaison(source_base,target_base,mode,temps_min,km,cout_carburant_eur,cout_peage_eur,cout_ferry_eur,cout_total_eur,n_ferries,joignable)
SELECT source_base,target_base,'default',(minutes_roulage+minutes_ferry),km,
  cout_carburant_eur,cout_peage_eur,cout_ferry_eur,cout_eur_total,n_ferries,true
FROM mcda2.matrice_base_base WHERE source_base<>target_base;

-- Modes re-tracés : sans_ferry (WHERE NOT is_ferry), sans_peage (WHERE coalesce(peage_eur,0)=0).
DO $$
DECLARE b RECORD; m RECORD;
  edge_sql text;
  conso numeric := (SELECT conso FROM _p); prix numeric := (SELECT prix FROM _p);
BEGIN
  FOR m IN SELECT * FROM (VALUES
      ('sans_ferry', 'AND NOT is_ferry'),
      ('sans_peage', 'AND coalesce(peage_eur,0)=0')) v(mode, filtre) LOOP
    edge_sql := 'SELECT id, source, target, cost_s AS cost, reverse_cost_s AS reverse_cost FROM staging.ways_ruteplan WHERE cost_s IS NOT NULL '||m.filtre;
    FOR b IN SELECT brn.base_id, brn.node_ruteplan FROM staging.base_ruteplan_node brn ORDER BY brn.base_id LOOP
      INSERT INTO mcda2.variante_liaison(source_base,target_base,mode,temps_min,km,cout_carburant_eur,cout_peage_eur,cout_ferry_eur,cout_total_eur,n_ferries,joignable)
      SELECT b.base_id, nb.base_id, m.mode,
        round((sum(d.cost)/60.0)::numeric,1),
        round((sum(w.length_m)/1000.0)::numeric,1),
        round((sum(w.length_m)/1000.0 * conso/100.0 * prix)::numeric,2),
        round(sum(w.peage_eur)::numeric,2),
        CASE WHEN m.mode='sans_ferry' THEN 0 ELSE NULL END,
        NULL,
        count(*) FILTER (WHERE w.is_ferry),
        true
      FROM pgr_dijkstra(edge_sql, b.node_ruteplan,
             ARRAY(SELECT node_ruteplan FROM staging.base_ruteplan_node WHERE base_id<>b.base_id), directed:=true) d
      JOIN staging.ways_ruteplan w ON w.id=d.edge AND d.edge<>-1
      JOIN staging.base_ruteplan_node nb ON nb.node_ruteplan=d.end_vid
      GROUP BY nb.base_id;
    END LOOP;
  END LOOP;
END $$;

-- cout_total = carburant + péage + ferry(0/NULL).
UPDATE mcda2.variante_liaison SET cout_total_eur = round((coalesce(cout_carburant_eur,0)+coalesce(cout_peage_eur,0)+coalesce(cout_ferry_eur,0))::numeric,2);
CREATE INDEX ON mcda2.variante_liaison(source_base,target_base,mode);

-- ferry_obligatoire : paires default sans équivalent sans_ferry joignable (île/presqu'île ferry-only).
UPDATE mcda2.matrice_base_base m SET ferry_obligatoire =
  (m.ferry AND NOT EXISTS (SELECT 1 FROM mcda2.variante_liaison v
     WHERE v.mode='sans_ferry' AND v.source_base=m.source_base AND v.target_base=m.target_base))
WHERE m.source_base<>m.target_base;

-- detour (coût d'éviter le ferry) = sans_ferry - default, quand détour possible.
UPDATE mcda2.matrice_base_base m
SET detour_possible = (sf.temps_min IS NOT NULL),
    roulage_detour_min = round((sf.temps_min - (m.minutes_roulage+m.minutes_ferry))::numeric,1),
    km_detour = round((sf.km - m.km)::numeric,1)
FROM (SELECT source_base,target_base,temps_min,km FROM mcda2.variante_liaison WHERE mode='sans_ferry') sf
WHERE sf.source_base=m.source_base AND sf.target_base=m.target_base AND m.ferry;

-- Vérifs.
\echo '== volumétrie par mode (default 10712 ; sans_* <= 10712, manquantes = injoignables) =='
SELECT mode, count(*), round(avg(temps_min)::numeric,0) temps_moy, round(avg(cout_total_eur)::numeric,1) eur_moy FROM mcda2.variante_liaison GROUP BY mode ORDER BY mode;
\echo '== ferry_obligatoire (paires ile-only) =='
SELECT count(*) FILTER (WHERE ferry_obligatoire) ferry_oblig, count(*) FILTER (WHERE ferry AND NOT ferry_obligatoire) ferry_evitable FROM mcda2.matrice_base_base WHERE source_base<>target_base;
\echo '== arbitrage ferry : detour moyen pour eviter un ferry evitable (min, km) =='
SELECT round(avg(roulage_detour_min)::numeric,0) detour_min_moy, round(avg(km_detour)::numeric,0) km_detour_moy, round(max(roulage_detour_min)::numeric,0) detour_max
FROM mcda2.matrice_base_base WHERE detour_possible AND ferry AND NOT ferry_obligatoire;
\echo '== exemple arbitrage (3 modes) base 1 -> 5 =='
SELECT mode, temps_min, km, cout_peage_eur, cout_total_eur FROM mcda2.variante_liaison WHERE source_base=1 AND target_base=5 ORDER BY mode;
