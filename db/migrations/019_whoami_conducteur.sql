-- 019_whoami_conducteur.sql (M420) — api.whoami expose l'attribut CONDUCTEUR (colonne membre.conducteur, posée par 013),
-- pour que le BFF le passe à peut() (regler_conduite exige conducteur=true + rôle d'organisateur, Guillaume 16/08).
--
-- Le rôle reste RENVOYÉ BRUT : la normalisation raw→canonique (owner→organisateur_principal, mamie/enfant→voyageur, …) est
-- appliquée AU BFF via la fonction SHARED `normaliserRoleBrut` (source unique, M420) — SQL ne peut pas importer shared, et
-- dupliquer la table en SQL casserait le « single source ». whoami fournit donc {membre_id, prenom, role brut, conducteur} ;
-- le BFF (services/identite.ts lireWhoami) rend {role canonique, qualification, conducteur}.
--
-- SURFACE : DB2 (norvege_v2). CREATE OR REPLACE (additif : ajoute la clé `conducteur`). DÉPEND de 013 (colonne conducteur).
-- GATE : appliqué au FLIP, APRÈS 013 (lot 012-019). VÉRIFIÉ en dry-run BEGIN…ROLLBACK (013+019) sur la vraie DB2, 0 committé.
-- Rollback = rejouer la définition d'avant (whoami sans conducteur).
-- Usage (flip) : cat db/migrations/019_*.sql | ssh bomp4rd "docker exec -i norvege-db psql -U norvege -d norvege_v2 -v ON_ERROR_STOP=1"

\set ON_ERROR_STOP on
BEGIN;

CREATE OR REPLACE FUNCTION api.whoami(code text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=api,membre,pg_temp AS $$
  SELECT to_jsonb(m) FROM (
    SELECT membre_id, prenom, role, COALESCE(conducteur, false) AS conducteur
    FROM membre.membre
    WHERE code_lien = code AND actif
  ) m;
$$;
COMMENT ON FUNCTION api.whoami(text) IS 'M052/M420 : identité du porteur du lien (non gaté PIN). Rend {membre_id, prenom, role BRUT, conducteur (013)}. Le BFF normalise le rôle (shared normaliserRoleBrut) → role canonique + qualification, et passe conducteur à peut().';

COMMIT;

-- ACCEPTATION (dry-run BEGIN…ROLLBACK, 013 puis 019, 0 committé) :
--   a) SELECT api.whoami(<code owner>)  ? 'conducteur';  -- true (clé présente)
--   b) SELECT api.whoami(<code owner>)->>'conducteur';   -- 'true' (owner passé conducteur par 013)
--   c) SELECT api.whoami(<code enfant>)->>'role';        -- 'enfant' (brut ; normalisé voyageur/enfant côté BFF)
-- Rollback : CREATE OR REPLACE FUNCTION api.whoami sans la colonne conducteur (définition M052 d'origine).
