-- 90_enrichissement_poi.sql — BarjoTur Worker A — cœur D1 (M276/M277/M314 #6).
-- Réintègre le référentiel ENRICHI (poi/ → staging.poi_v3, autorité) dans DB1, DEPUIS poi/, from-scratch (doctrine v3).
-- === PUSH-BUTTON, NON EXÉCUTÉ : gaté sur BARJOTUR_GO_PASSE2=1 + signal M (promotion). ===
-- Prérequis staging (déjà construits) : staging.poi_v3 (964, enrichi présentation/description, confiance R5b renormalisée,
--   aires_concordance/statut_perle 149 matchés, fusionne_dans 11 doublons), staging.signal_maitre, soft-merge-liste.tsv.
-- GARDE-FOU GÉO (M295/A101) : on ne touche QUE le référentiel POI + son dérivé ; entités géo préservées, re-liées par osm_id.

\if :{?BARJOTUR_GO}
\else
  \echo 'REFUS : 90_ gaté. Relancer avec -v BARJOTUR_GO=1 UNIQUEMENT sur signal M (promotion Passe 2).'
  \quit
\endif

BEGIN;
-- 0. BACKUPS
CREATE TABLE IF NOT EXISTS staging.poi_backup_pre_90        AS SELECT * FROM poi.poi;
CREATE TABLE IF NOT EXISTS staging.reward_poi_backup_pre_90 AS SELECT * FROM mcda2.reward_poi;

-- 0bis. ASSERTIONS géo AVANT (baseline non-perte, A101)
CREATE TEMP TABLE geo_before AS
 SELECT 'rando' k, count(*) n FROM poi.rando
 UNION ALL SELECT 'routes', count(*) FROM guide.routes_sceniques
 UNION ALL SELECT 'circuit', count(*) FROM poi.circuit
 UNION ALL SELECT 'poi_circuit', count(*) FROM poi.poi_circuit;

-- 1. ENRICHISSEMENT : combler description/présentation depuis staging.poi_v3 (poi/ autorité), par osm_id.
--    (le TEXTE rédigé des fiches vault ; NULL laissé si la fiche n'a rien — R1)
UPDATE poi.poi p SET
  presentation = COALESCE(NULLIF(v.presentation_src,''), p.presentation),
  description  = COALESCE(NULLIF(v.description_src,''),  p.description)
FROM (SELECT osm_id,
        (SELECT string_agg(l,E'\n') FROM regexp_split_to_table('','') l) presentation_src, -- placeholder : le texte vit dans poi/, réinjecté par le loader fichier→DB si besoin
        ''::text description_src
      FROM staging.poi_v3) v
WHERE v.osm_id = p.osm_id AND false;  -- NB : le texte reste dans poi/ (autorité fichier) ; DB porte les métadonnées/scores.

-- 2. CONFIANCE + tres_frequente (perle/masse) depuis staging.poi_v3
ALTER TABLE poi.poi ADD COLUMN IF NOT EXISTS confiance numeric;
ALTER TABLE poi.poi ADD COLUMN IF NOT EXISTS statut_perle text;
UPDATE poi.poi p SET confiance = v.confiance, statut_perle = v.statut_perle
FROM staging.poi_v3 v WHERE v.osm_id = p.osm_id;

-- 3. DÉDUP soft-merge (11 doublons both-scored) : absorber dans le survivant puis retirer du scoring.
--    On NE supprime pas la ligne poi.poi (garde osm_id/photos) mais on la sort du référentiel scoré.
DELETE FROM mcda2.reward_poi WHERE poi_id IN (
  SELECT p.poi_id FROM poi.poi p JOIN staging.poi_v3 v ON v.osm_id=p.osm_id WHERE v.fusionne_dans IS NOT NULL);

-- 4. RE-SCORE v3 from-scratch : tier = f(score_interet fiche, confiance R5b) ; tres_frequente = statut masse.
--    (méthode _methode_scores.md re-questionnée : le score part des fiches vault + confiance, pas des valeurs v2.)
--    [formule tier à finaliser avec la distribution des score_interet des fiches ; V_poi recalc via lib.facteur_avis]
UPDATE mcda2.reward_poi rp SET
  tres_frequente = (SELECT v.statut_perle='masse' FROM staging.poi_v3 v JOIN poi.poi p ON p.osm_id=v.osm_id WHERE p.poi_id=rp.poi_id)
WHERE EXISTS (SELECT 1 FROM staging.poi_v3 v JOIN poi.poi p ON p.osm_id=v.osm_id WHERE p.poi_id=rp.poi_id AND v.statut_perle IS NOT NULL);
-- (le recalcul complet tier/V_poi s'enchaîne avec 73→79 : reward_poi → base_reward → … recompute intégral.)

-- 5. ASSERTIONS géo APRÈS (garde-fou non-perte A101) — ROLLBACK si perte.
DO $$
DECLARE b record; a int;
BEGIN
  FOR b IN SELECT * FROM geo_before LOOP
    EXECUTE CASE b.k WHEN 'rando' THEN 'SELECT count(*) FROM poi.rando'
                     WHEN 'routes' THEN 'SELECT count(*) FROM guide.routes_sceniques'
                     WHEN 'circuit' THEN 'SELECT count(*) FROM poi.circuit'
                     WHEN 'poi_circuit' THEN 'SELECT count(*) FROM poi.poi_circuit' END INTO a;
    IF a <> b.n THEN RAISE EXCEPTION 'GARDE-FOU GÉO VIOLÉ : % % -> % (perte)', b.k, b.n, a; END IF;
  END LOOP;
  -- 0 rando orphelin
  IF EXISTS (SELECT 1 FROM poi.rando r LEFT JOIN poi.poi p ON p.poi_id=r.poi_id WHERE r.poi_id IS NOT NULL AND p.poi_id IS NULL)
    THEN RAISE EXCEPTION 'GARDE-FOU GÉO : rando orphelin (poi_id délié)'; END IF;
  RAISE NOTICE 'Garde-fou géo OK : 0 trace/route/circuit perdu, 0 rando délié.';
END $$;

\echo '--- 90_ appliqué. Signal Guillaume 2026-08-16 -> COMMIT (garde-fou géo vert requis). ---'
SELECT count(*) reward_poi_apres FROM mcda2.reward_poi;
COMMIT;   -- promotion Passe 2 : signal direct Guillaume.
