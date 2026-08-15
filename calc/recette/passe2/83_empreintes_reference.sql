-- 83_empreintes_reference.sql (M459 cleanup #2, A154) — GÉNÉRATEUR VERSIONNÉ des empreintes de référence v3.
-- Clôt le manquement repro : toute empreinte figée sort désormais de CE script rejouable, jamais d'un calcul ad hoc.
-- Recette CANONIQUE (A078) : SET extra_float_digits=3 ; md5(string_agg(md5(t.*::text), '' ORDER BY <clé>)) FROM (<projection stable>) t.
-- La projection exclut les colonnes volatiles (geom, jsonb) ; l'ordre est déterministe. Identique côté DB2 (parité).
-- Specs pilotées par une table (meta.empreinte_spec) → ajouter une relation = 1 ligne, sans toucher au moteur.
-- Régénère le TSV :  psql ... -Aqt -f 83_empreintes_reference.sql > db/sync/empreintes-reference.tsv  (après en-tête)
-- Usage crible :     psql -h localhost -p 5433 -d norvege_routing -v ON_ERROR_STOP=1 -f calc/recette/passe2/83_empreintes_reference.sql
\set ON_ERROR_STOP on
SET extra_float_digits = 3;

CREATE SCHEMA IF NOT EXISTS meta;

-- Registre des projections d'empreinte (source de vérité de la recette par relation)
CREATE TABLE IF NOT EXISTS meta.empreinte_spec (
  relation   text PRIMARY KEY,   -- schéma.table
  projection text NOT NULL,      -- colonnes stables, ordonnées, séparées par des virgules
  ordre      text NOT NULL,      -- ORDER BY (doit être inclus dans la projection)
  note       text
);
INSERT INTO meta.empreinte_spec (relation, projection, ordre, note) VALUES
  ('mcda2.reward_poi',    'poi_id, v_poi, tier, tres_frequente',                                'poi_id',  'gate go-live v3'),
  ('mcda2.base_reward',   'base_id, reward_atteignable, n_poi',                                  'base_id', 'gate go-live v3'),
  ('mcda2.bases_ideales', 'base_id, mclp_rang, structurante, reward, rayonnement, zero_reward',  'base_id', 'gate go-live v3')
ON CONFLICT (relation) DO UPDATE SET projection=EXCLUDED.projection, ordre=EXCLUDED.ordre, note=EXCLUDED.note;

-- Moteur : calcule l'empreinte de chaque relation de la spec (recette canonique)
CREATE OR REPLACE FUNCTION meta.empreinte_reference()
RETURNS TABLE(relation text, lignes bigint, md5 text, projection text, ordre text)
LANGUAGE plpgsql AS $$
DECLARE s record; h text; n bigint;
BEGIN
  SET LOCAL extra_float_digits = 3;
  FOR s IN SELECT * FROM meta.empreinte_spec ORDER BY relation LOOP
    EXECUTE format('SELECT count(*), md5(string_agg(md5(t.*::text), %L ORDER BY %s)) FROM (SELECT %s FROM %s) t',
                   '', s.ordre, s.projection, s.relation) INTO n, h;
    relation := s.relation; lignes := n; md5 := h; projection := s.projection; ordre := s.ordre; RETURN NEXT;
  END LOOP;
END $$;

-- Sortie TSV (relation<TAB>lignes<TAB>md5<TAB>projection<TAB>ordre)
SELECT relation, lignes, md5, projection, ordre FROM meta.empreinte_reference();
