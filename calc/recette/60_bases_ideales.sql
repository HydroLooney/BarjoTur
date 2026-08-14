-- 60_bases_ideales.sql (tâche A-11 : bases idéales par COUVERTURE, indépendantes des votes).
-- Doctrine doc 10 : on GÉNÈRE des candidates par couverture (le composeur choisira parmi elles) ; indépendant
-- des votes. Depuis les 3612 aires van-ok (bases_vanok_candidats), pas les 105 v2 (greenfield, plan v3 #11).
--
-- MÉTHODE : greedy MCLP (Maximal Coverage Location) sur la couverture qualité, avec séparation spatiale.
--   * Couverture pondérée candidat×POI : w = exp(−d_km/20), POI qualité ≤40 km (`_cand_poi_w`).
--   * À chaque tour : on prend le candidat au gain MARGINAL max (Σ w·résiduel_POI), on sature les POI couverts
--     (résiduel ×= (1−w)), et on impose une SÉPARATION ≥15 km (pas deux bases idéales collées).
--   * S'arrête à K=60 candidates ou gain < 0,05 (rendements décroissants).
--
-- ⚠ COUVERTURE EUCLIDIENNE (proxy) à ce stade : rapide sur 3612 candidats, mais ignore fjords/routes. C'est un
-- PREMIER JET / shortlist honnête. Raffinement RÉSEAU (rayonnement anti-MAUP, comme base_rayonnement) sur la
-- sélection = étape suivante (60b, background). Flag M.
--
-- Idempotent. poi.poi / candidats read-only. Usage : psql ... -f calc/recette/60_bases_ideales.sql
-- (Prérequis : `_cand_couverture_euclid` et `_cand_poi_w` déjà construits, cf. amont du script / JOURNAL.)

\set ON_ERROR_STOP on
\set K 60
\set sep_m 15000
\set gain_min 0.05

DROP TABLE IF EXISTS mcda2.bases_ideales;
CREATE TABLE mcda2.bases_ideales (
  rang       int PRIMARY KEY,
  point_id   bigint UNIQUE,
  gain       double precision,   -- couverture marginale ajoutée à la sélection à ce tour
  couv_totale double precision,   -- couverture euclidienne absolue du candidat (référence)
  name       text,
  zone_id    text,
  geom       geometry
);

DO $$
DECLARE
  k int := 0;
  best_id bigint; best_gain double precision;
BEGIN
  CREATE TEMP TABLE _resid ON COMMIT DROP AS
    SELECT DISTINCT poi_id, qualite AS residual FROM mcda2._cand_poi_w;

  LOOP
    EXIT WHEN k >= 60;
    -- Meilleur candidat par gain marginal, hors sélectionnés et hors zone de séparation (<15 km d'un déjà pris).
    SELECT cp.point_id, sum(cp.w * r.residual)
      INTO best_id, best_gain
    FROM mcda2._cand_poi_w cp
    JOIN _resid r ON r.poi_id = cp.poi_id
    WHERE cp.point_id NOT IN (SELECT point_id FROM mcda2.bases_ideales)
      AND NOT EXISTS (
        SELECT 1 FROM mcda2.bases_ideales bi
        JOIN mcda2.bases_vanok_candidats cc ON cc.point_id = cp.point_id
        WHERE ST_DWithin(bi.geom::geography, cc.geom::geography, 15000))
    GROUP BY cp.point_id
    ORDER BY 2 DESC
    LIMIT 1;

    EXIT WHEN best_id IS NULL OR best_gain < 0.05;
    k := k + 1;

    INSERT INTO mcda2.bases_ideales (rang, point_id, gain, couv_totale, name, zone_id, geom)
    SELECT k, c.point_id, best_gain, cc.couv_euclid, c.name, c.zone_id, c.geom
    FROM mcda2.bases_vanok_candidats c
    JOIN mcda2._cand_couverture_euclid cc ON cc.point_id = c.point_id
    WHERE c.point_id = best_id;

    -- Saturation : les POI couverts par ce candidat deviennent moins « demandeurs ».
    UPDATE _resid r SET residual = residual * (1 - cp.w)
    FROM mcda2._cand_poi_w cp
    WHERE cp.point_id = best_id AND cp.poi_id = r.poi_id;
  END LOOP;
END $$;

COMMENT ON TABLE mcda2.bases_ideales IS
  'A-11 : bases idéales par couverture (greedy MCLP, indépendant des votes), depuis les 3612 aires van-ok. '
  'Couverture EUCLIDIENNE (proxy, séparation 15 km) = premier jet ; raffinement réseau = étape 60b. 60_bases_ideales.sql.';

-- Vérifications.
\echo '== bases_ideales : nombre retenu + gains décroissants (rendements) =='
SELECT count(*) n_bases, round(max(gain)::numeric,2) gain_max, round(min(gain)::numeric,2) gain_min,
       round(sum(gain)::numeric,1) couv_cumulee FROM mcda2.bases_ideales;
\echo '== top 8 (gain décroissant) + zone =='
SELECT rang, point_id, round(gain::numeric,2) gain, round(couv_totale::numeric,2) couv, zone_id, left(coalesce(name,'(sans nom)'),30) nom
FROM mcda2.bases_ideales ORDER BY rang LIMIT 8;
\echo '== couverture spatiale : nb de zones distinctes touchées =='
SELECT count(DISTINCT zone_id) zones_couvertes FROM mcda2.bases_ideales WHERE zone_id IS NOT NULL;
