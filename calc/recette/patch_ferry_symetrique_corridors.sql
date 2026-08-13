-- patch_ferry_symetrique_corridors.sql
-- Comble le trou de matrice 6->74 par une arête FERRY symétrique du retour existant 74->6.
-- Décision Guillaume M006 : PAS de tunnel, PAS de péage de tunnel (Hordfast = années 2030,
-- inexistant pour août 2027). Honnête R1 : ce corridor est un ferry (deux car-ferries réels :
-- Jektavik-Hodnanes + Vage-Halhjem, M009).
--
-- 82<->77 EXCLU (R1, M009) : l'arête que DB1 avait routée pour 77->82 est l'Hardangerfjordekspressen
-- (Rodne), un BATEAU PASSAGERS, pas un car-ferry -> non empruntable en van. Symétriser copierait un
-- chemin invalide. À RE-ROUTER par le car-ferry Vage-Halhjem (seul car-ferry Tysnes<->continent) avant
-- de figer ; travail de la matrice A* (30_matrices). Le retour existant 77->82 est lui aussi invalide
-- pour le van et sera corrigé au recalcul.
--
-- Idempotent (NOT EXISTS), réversible (voir REVERT ci-dessous), non destructif.
-- SUBSUMÉ par 30_matrices (matrice A* complète Option B) : quand la matrice canonique est
-- rebâtie en A*, les traversées insulaires sont modélisées nativement ; ce patch devient inutile.
-- Coût MONÉTAIRE ferry = couche € séparée (6<->74 = 198 NOK/sens : 69 Jektavik-Hodnanes + 129 Vage-Halhjem, M009).
--
-- Usage :  psql -h localhost -p 5433 -d norvege_routing -f calc/recette/patch_ferry_symetrique_corridors.sql
-- REVERT : DELETE FROM mcda2.base_base_routes_v2 WHERE (src_base,tgt_base) = (6,74)
--          AND has_ferry AND traversee_insulaire;   (cette paire était absente avant le patch)

\set ON_ERROR_STOP on
BEGIN;

-- Paires-trous à combler (src_manquant, tgt_manquant) ; leur retour (tgt->src) doit exister ET être van-valide.
-- 82<->77 volontairement absent (R1 M009 : retour invalide, re-route requis).
CREATE TEMP TABLE _holes(a int, b int) ON COMMIT DROP;
INSERT INTO _holes VALUES (6, 74);

-- Journal de provenance (réversibilité + traçabilité, doctrine A14).
CREATE TABLE IF NOT EXISTS staging.log_fill_ferry_symetrique(
  src_base int, tgt_base int, mirror_de_src int, mirror_de_tgt int,
  cost_s double precision, applique_le timestamptz DEFAULT now(),
  note text DEFAULT 'M006 ferry-symétrique, pas de tunnel'
);

-- Contrôle amont : chaque trou a bien un retour ferry à mirrorer ; sinon on refuse (R1).
DO $$
DECLARE manquants int;
BEGIN
  SELECT count(*) INTO manquants
  FROM _holes h
  WHERE NOT EXISTS (SELECT 1 FROM mcda2.base_base_routes_v2 r
                    WHERE r.src_base=h.b AND r.tgt_base=h.a AND r.has_ferry);
  IF manquants > 0 THEN
    RAISE EXCEPTION 'Refus : % paire(s)-trou sans retour ferry à mirrorer', manquants;
  END IF;
END $$;

-- Insertion des miroirs : sens inversé, vids échangés, géométrie retournée, coût-temps identique.
WITH ins AS (
  INSERT INTO mcda2.base_base_routes_v2
    (start_vid, end_vid, src_base, tgt_base, cost_s, length_m, has_ferry, n_edges, geom, traversee_insulaire)
  SELECT r.end_vid, r.start_vid, h.a, h.b, r.cost_s, r.length_m, r.has_ferry, r.n_edges,
         ST_Reverse(r.geom), r.traversee_insulaire
  FROM _holes h
  JOIN mcda2.base_base_routes_v2 r ON r.src_base=h.b AND r.tgt_base=h.a AND r.has_ferry
  WHERE NOT EXISTS (SELECT 1 FROM mcda2.base_base_routes_v2 x
                    WHERE x.src_base=h.a AND x.tgt_base=h.b)   -- idempotent
  RETURNING src_base, tgt_base, cost_s
)
INSERT INTO staging.log_fill_ferry_symetrique(src_base, tgt_base, mirror_de_src, mirror_de_tgt, cost_s)
SELECT src_base, tgt_base, tgt_base, src_base, cost_s FROM ins;

COMMIT;

-- Vérification (verification-before-completion) : le corridor 6<->74 est présent ET symétrique.
\echo '== Corridor 6<->74 après patch (attendu : 2 lignes, coût miroir). 82<->77 volontairement exclu (R1 M009). =='
SELECT src_base, tgt_base, round(cost_s) cost_s, has_ferry, traversee_insulaire
FROM mcda2.base_base_routes_v2
WHERE (src_base,tgt_base) IN ((6,74),(74,6))
ORDER BY src_base;

\echo '== Contrôle symétrie 6<->74 (attendu : 0 asymétrique parmi les 2) =='
SELECT count(*) AS corridor_asymetrique
FROM (VALUES (6,74),(74,6)) v(a,b)
LEFT JOIN mcda2.base_base_routes_v2 r ON r.src_base=v.a AND r.tgt_base=v.b
WHERE r.src_base IS NULL;
