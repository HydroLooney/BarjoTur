-- 60_type_activite.sql, typologie des activités + budget-temps de visite (A21 / M089).
-- Source unique côté A de la DURÉE PAR TYPE (plancher, défaut, max, granularité, paliers, thèmes). Affinable par lieu
-- (override defaut_min par POI, chantier séparé après R13 sur le mapping POI→type). Paliers réglables en routing_params.
-- Arrondi PAS_MIN=15 (jamais 30). Le calcul de duree_proposee (clamp × avis × appétit) est une fonction séparée (61_).
-- Usage : PGOPTIONS="-c client_min_messages=warning" psql -h localhost -p 5433 -d norvege_routing -v ON_ERROR_STOP=1 -f calc/recette/60_type_activite.sql

\set ON_ERROR_STOP on

-- Paliers réglables single-source (repères A21 : demi-journée 240, journée 480, pas 15).
INSERT INTO mcda2.routing_params(profil, param, valeur, unite, description) VALUES
 ('activite','pas_min',15,'min','Arrondi des durées (A21 : jamais 30)'),
 ('activite','demi_journee_min',240,'min','Repère palier demi-journée (réglable)'),
 ('activite','journee_min',480,'min','Repère palier journée (réglable)')
ON CONFLICT DO NOTHING;

-- Typologie. granularite : libre | demi_journee | journee. granularites = paliers offerts si non libre.
DROP TABLE IF EXISTS mcda2.type_activite;
CREATE TABLE mcda2.type_activite (
  code text PRIMARY KEY,
  libelle text NOT NULL,
  min_min int NOT NULL,
  defaut_min int NOT NULL,
  max_min int,
  granularite text NOT NULL CHECK (granularite IN ('libre','demi_journee','journee')),
  granularites int[],
  themes text[] NOT NULL DEFAULT '{}',
  CHECK (defaut_min >= min_min AND (max_min IS NULL OR defaut_min <= max_min))
);
COMMENT ON TABLE mcda2.type_activite IS 'A21/M089 : durée par type d''activité (plancher/défaut/max/palier/thèmes). Source unique A, affinable par POI. Seed 14/08.';

-- Défauts A21 (durées en minutes, multiples de 15). Thèmes = chaîne ouverte (nautique, faune, patrimoine…).
INSERT INTO mcda2.type_activite(code, libelle, min_min, defaut_min, max_min, granularite, granularites, themes) VALUES
 ('baignade',     'Baignade',                 60,  90,  240, 'libre',        NULL,        ARRAY['baignade','nautique']),
 ('kayak',        'Kayak / canoë',           240, 240,  480, 'demi_journee', ARRAY[240,480], ARRAY['nautique','aventure']),
 ('point_de_vue', 'Point de vue / panorama',  15,  20,   90, 'libre',        NULL,        ARRAY['panorama']),
 ('musee',        'Musée / site culturel',    60,  90,  180, 'libre',        NULL,        ARRAY['patrimoine','culture']),
 ('safari_faune', 'Safari photo faune',      120, 180,  480, 'libre',        NULL,        ARRAY['faune','nature']),
 ('cascade',      'Cascade',                  15,  30,   90, 'libre',        NULL,        ARRAY['nature','panorama']),
 ('glacier',      'Glacier / front glaciaire',60, 120,  480, 'libre',        NULL,        ARRAY['nature','panorama','aventure']),
 ('rando',        'Randonnée',                60, 180, 1440, 'libre',        NULL,        ARRAY['rando','nature']),
 ('flanerie',     'Flânerie (village, port)', 30,  60,  240, 'libre',        NULL,        ARRAY['flanerie']);

\echo '== Typologie posée =='
SELECT code, min_min, defaut_min, max_min, granularite, granularites, themes FROM mcda2.type_activite ORDER BY code;
\echo '== Contrôle arrondi 15 (0 attendu) =='
SELECT count(*) non_multiples_15 FROM mcda2.type_activite WHERE min_min%15<>0 OR defaut_min%15<>0 OR coalesce(max_min,0)%15<>0;
