-- 020_philosophie_voyageur.sql (M508 / crible B159) — profil de PHILOSOPHIE de voyage par voyageur, canonique MCDA v3
-- (note 04 : 7 curseurs bipolaires ; note 05 : 4 envies live). Source unique DB2, liée au membre, VERSIONNÉE et rejouable
-- (M487 « une vérité par utilisateur »). Remplace l'ancien modèle 8 axes (ex-Étude Voter, caduc). Le contrat de types est
-- shared/src/philosophie.ts (PhilosophieProfil/CurseurCatalogue/EnvieCatalogue, posé par M, 3c46a57).
--
-- LIVE = 7 curseurs + 4 envies (th_*) + cap_nord. Nouveauté/Tempo = STOCKÉS mais actif_live=false (non câblés au reward_base
-- live ; v3.1). Catalogue RPM complet (cible/soft/hard, ~11 envies) = v3.1. Les libellés viennent d'ICI (jamais codés en dur
-- côté front), cohérents note 04 / A159.
--
-- SURFACE : DB2 (norvege_v2), schéma `decision`. Non précieux (préférences, pas votes/membres). Additif pur (CREATE IF NOT
-- EXISTS + CREATE OR REPLACE). GATE : dry-run BEGIN…ROLLBACK sur la vraie DB2 (0 committé) puis APPLY au feu de M.
-- Rollback = DROP des 3 tables + des 2 fonctions api.philosophie_*.
-- Usage : cat db/migrations/020_*.sql | ssh bomp4rd "docker exec -i norvege-db psql -U norvege -d norvege_v2 -v ON_ERROR_STOP=1"

\set ON_ERROR_STOP on
BEGIN;

-- 1) Catalogue des 7 curseurs bipolaires (libellés A159 / note 04). Rendu par le front, jamais codé en dur.
CREATE TABLE IF NOT EXISTS decision.philosophie_curseur (
  cle        text PRIMARY KEY,
  libelle    text NOT NULL,
  pole_a     text NOT NULL,          -- valeur 0
  pole_b     text NOT NULL,          -- valeur 1
  ancrage    text,                   -- aide pédagogique sous le curseur
  defaut     numeric NOT NULL DEFAULT 0.5 CHECK (defaut BETWEEN 0 AND 1),
  actif_live boolean NOT NULL DEFAULT true,   -- influence déjà le composeur live ? (Nouveauté/Tempo = false, v3.1)
  ordre      int NOT NULL
);

-- 2) Catalogue des envies live (mappées sur th_*). Extensible (+7 en v3.1, WOWA-RPM).
CREATE TABLE IF NOT EXISTS decision.envie_catalogue (
  cle        text PRIMARY KEY,
  libelle    text NOT NULL,
  defaut     numeric NOT NULL DEFAULT 0.5 CHECK (defaut BETWEEN 0 AND 1),
  actif_live boolean NOT NULL DEFAULT true,
  ordre      int NOT NULL
);

-- 3) Profil par voyageur, VERSIONNÉ (rejouable). Le courant = la version max. Profil complet en jsonb (validé côté BFF
--    contre CURSEUR_CLES/ENVIE_CLES). Lié au membre (source unique).
CREATE TABLE IF NOT EXISTS decision.philosophie_voyageur (
  membre_id int  NOT NULL REFERENCES membre.membre(membre_id) ON DELETE CASCADE,
  version   int  NOT NULL,
  profil    jsonb NOT NULL,
  maj_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (membre_id, version)
);

-- Seed catalogues (idempotent). Pôles orientés comme le DTO (0 = pole_a, 1 = pole_b).
INSERT INTO decision.philosophie_curseur (cle, libelle, pole_a, pole_b, ancrage, actif_live, ordre) VALUES
  ('rythme',    'Rythme',    'Contemplation', 'Découverte',        'Se poser longtemps sur peu de bases, ou enchaîner les découvertes.',              true,  1),
  ('registre',  'Registre',  'Nature',        'Culture et villages','Nature sauvage et grands espaces, ou villages, culture et vie locale.',           true,  2),
  ('nuit',      'Nuit',      'Confort',       'Autonomie',         'Campings et services, ou bivouac autonome (borné par le budget électrique).',      true,  3),
  ('foule',     'Foule',     'Iconique',      'Hors des sentiers', 'Les incontournables réputés, ou les coins à l''écart de la foule.',               true,  4),
  ('nouveaute', 'Nouveauté', 'Explorer large','Approfondir',       'Voir un maximum de lieux différents, ou approfondir quelques-uns.',                false, 5),
  ('effort',    'Effort',    'Doux et repos', 'Sportif',           'Balades douces et repos, ou randonnées engagées.',                                true,  6),
  ('tempo',     'Tempo',     'Planning calé', 'Place à l''imprévu','Un programme cadré, ou de la marge pour l''imprévu.',                             false, 7)
ON CONFLICT (cle) DO UPDATE SET
  libelle=EXCLUDED.libelle, pole_a=EXCLUDED.pole_a, pole_b=EXCLUDED.pole_b,
  ancrage=EXCLUDED.ancrage, actif_live=EXCLUDED.actif_live, ordre=EXCLUDED.ordre;

INSERT INTO decision.envie_catalogue (cle, libelle, actif_live, ordre) VALUES
  ('paysage',  'Panoramas et paysages',            true, 1),
  ('rando',    'Randonnées',                       true, 2),
  ('nautique', 'Kayak, croisières, nautique',      true, 3),
  ('culturel', 'Musées, villages, sites culturels',true, 4)
ON CONFLICT (cle) DO UPDATE SET libelle=EXCLUDED.libelle, actif_live=EXCLUDED.actif_live, ordre=EXCLUDED.ordre;

-- 4) Profil par défaut (tous curseurs/envies au défaut du catalogue, cap_nord 0.5) — jsonb, source unique des défauts.
CREATE OR REPLACE FUNCTION decision.philosophie_defaut()
RETURNS jsonb LANGUAGE sql STABLE SET search_path=decision,pg_temp AS $$
  SELECT jsonb_build_object(
    'curseurs', (SELECT jsonb_object_agg(cle, defaut) FROM decision.philosophie_curseur),
    'envies',   (SELECT jsonb_object_agg(cle, defaut) FROM decision.envie_catalogue),
    'cap_nord', 0.5
  );
$$;

-- 5) LIRE : catalogue (libellés) + profil courant (ou défaut) + version. :code → membre via code_lien.
CREATE OR REPLACE FUNCTION api.philosophie_lire(p_code text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=api,decision,membre,pg_temp AS $$
DECLARE
  v_membre int;
  v_profil jsonb;
  v_version int;
BEGIN
  SELECT membre_id INTO v_membre FROM membre.membre WHERE code_lien = p_code AND actif;
  IF v_membre IS NULL THEN
    RETURN NULL;   -- lien non reconnu : le BFF renvoie une 404 propre
  END IF;

  SELECT profil, version INTO v_profil, v_version
  FROM decision.philosophie_voyageur
  WHERE membre_id = v_membre
  ORDER BY version DESC LIMIT 1;

  RETURN jsonb_build_object(
    'catalogue', jsonb_build_object(
      'curseurs', (SELECT jsonb_agg(jsonb_build_object(
                      'cle',cle,'libelle',libelle,'poleA',pole_a,'poleB',pole_b,
                      'ancrage',ancrage,'defaut',defaut,'actifLive',actif_live) ORDER BY ordre)
                   FROM decision.philosophie_curseur),
      'envies',   (SELECT jsonb_agg(jsonb_build_object(
                      'cle',cle,'libelle',libelle,'defaut',defaut,'actifLive',actif_live) ORDER BY ordre)
                   FROM decision.envie_catalogue)
    ),
    'profil',  COALESCE(v_profil, decision.philosophie_defaut()),
    'version', v_version
  );
END;
$$;
COMMENT ON FUNCTION api.philosophie_lire(text) IS 'M508 : catalogue (libellés A159/note04) + profil philo courant (ou défaut) + version, pour le porteur du lien.';

-- 6) ÉCRIRE : insère une NOUVELLE version (rejouable) avec le profil complet fourni (le BFF a fusionné le partiel + validé
--    les clés contre CURSEUR_CLES/ENVIE_CLES). Rend {version}.
CREATE OR REPLACE FUNCTION api.philosophie_ecrire(p_code text, p_profil jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=api,decision,membre,pg_temp AS $$
DECLARE
  v_membre int;
  v_version int;
BEGIN
  SELECT membre_id INTO v_membre FROM membre.membre WHERE code_lien = p_code AND actif;
  IF v_membre IS NULL THEN
    RETURN jsonb_build_object('erreur','lien_non_reconnu');
  END IF;

  SELECT COALESCE(max(version),0)+1 INTO v_version FROM decision.philosophie_voyageur WHERE membre_id = v_membre;
  INSERT INTO decision.philosophie_voyageur (membre_id, version, profil) VALUES (v_membre, v_version, p_profil);

  RETURN jsonb_build_object('version', v_version);
END;
$$;
COMMENT ON FUNCTION api.philosophie_ecrire(text, jsonb) IS 'M508 : enregistre une nouvelle version du profil philo du porteur du lien (versionné, rejouable). Rend {version}.';

COMMIT;

-- ACCEPTATION (dry-run BEGIN…ROLLBACK, 0 committé) :
--   a) SELECT jsonb_pretty(api.philosophie_lire(<code Guillaume>));  -- catalogue 7 curseurs + 4 envies + profil défaut, version NULL
--   b) SELECT api.philosophie_ecrire(<code Guillaume>, '{"curseurs":{"registre":0.2},"envies":{"rando":0.9},"cap_nord":0.7}'::jsonb); -- {version:1}
--   c) SELECT api.philosophie_lire(<code Guillaume>)->'profil';       -- le profil écrit, version 1
--   d) SELECT api.philosophie_lire('gb-inexistant');                  -- NULL (lien non reconnu)
-- Rollback : DROP FUNCTION api.philosophie_lire(text), api.philosophie_ecrire(text,jsonb), decision.philosophie_defaut();
--            DROP TABLE decision.philosophie_voyageur, decision.envie_catalogue, decision.philosophie_curseur;
