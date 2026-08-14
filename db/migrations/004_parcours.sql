-- 004_parcours.sql (B-20, pré-écrit sur feu M050 — NON exécuté ; à rejouer en DB2 au flip, règle DB2 owner-safe).
-- Pose la persistance de la MACHINE À CRANS (A18) : table `parcours.etat` (état vivant par voyage) + 2 RPC.
--
-- SURFACE : DB2 (norvege_v2, Bomp4rd). `parcours.etat` est PRÉCIEUSE (état utilisateur vivant, comme
-- decision.*/membre.*/fige.*/votes) : ELLE N'ENTRE JAMAIS DANS LA SYNC B-15 (parcours.* est à la denylist de
-- sync-db1-db2.sh + 003). Le dump DB1→DB2 ne doit jamais la toucher.
--
-- MULTI-VOYAGE (M049/M050) : clé `voyage_id` en PK ; aucun voyage codé en dur. Un voyage = une ligne.
-- IDENTITÉ / PIN (M048 §7.4) : `parcours_enregistrer` vérifie côté serveur que le membre est organisateur ET que le
-- PIN correspond, en réutilisant l'infra existante `api.verifier_pin(code_lien, pin)`. Le PIN ne transite jamais dans
-- l'état ni la réponse. Rôle organisateur = vocabulaire physique DB2 `owner` OU contrat `organisateur*` (écart B034).
--
-- IDEMPOTENT : CREATE ... IF NOT EXISTS + CREATE OR REPLACE. Rejouable sans effet de bord.
-- Usage (DB2, au flip) : psql "<dsn_db2>" -v ON_ERROR_STOP=1 -f db/migrations/004_parcours.sql

\set ON_ERROR_STOP on
BEGIN;

-- 1. Schéma + table d'état (un blob EtatParcours par voyage ; audit valide_at/valide_par porté DANS le blob).
CREATE SCHEMA IF NOT EXISTS parcours;
COMMENT ON SCHEMA parcours IS 'Machine à crans A18 (état vivant du cycle de vie par voyage). PRÉCIEUSE : hors sync B-15.';

CREATE TABLE IF NOT EXISTS parcours.etat (
  voyage_id bigint PRIMARY KEY,
  etat      jsonb  NOT NULL,
  maj_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE parcours.etat IS 'B-20 : EtatParcours (crans + états + audit) par voyage. PK voyage_id = multi-voyage-ready. PRÉCIEUSE (jamais dans la sync DB1→DB2).';

-- 2. Lecture : rend le blob EtatParcours, ou NULL si le voyage n'a pas encore d'état (le BFF seed parcoursNeuf).
CREATE OR REPLACE FUNCTION api.parcours_lire(p_voyage_id bigint)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=api,parcours,public,pg_temp AS $$
  SELECT etat FROM parcours.etat WHERE voyage_id = p_voyage_id;
$$;
COMMENT ON FUNCTION api.parcours_lire(bigint) IS 'B-20 : EtatParcours d''un voyage (NULL si absent → le BFF seed parcoursNeuf). Lecture ouverte.';
GRANT EXECUTE ON FUNCTION api.parcours_lire(bigint) TO web_anon;

-- 3. Écriture gatée : membre organisateur du voyage + PIN correct (autorité serveur), puis upsert.
CREATE OR REPLACE FUNCTION api.parcours_enregistrer(p_voyage_id bigint, p_etat jsonb, p_membre_id bigint, p_pin text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=api,membre,parcours,public,pg_temp AS $$
DECLARE v_code text; v_role text;
BEGIN
  SELECT code_lien, role INTO v_code, v_role FROM membre.membre WHERE membre_id = p_membre_id AND actif;
  IF v_code IS NULL THEN RETURN jsonb_build_object('ok',false,'error','membre inconnu'); END IF;
  -- Rôle organisateur : physique DB2 `owner` OU vocabulaire contrat `organisateur*` (écart de vocabulaire, B034).
  IF v_role NOT IN ('owner','organisateur','organisateur_principal') THEN
    RETURN jsonb_build_object('ok',false,'error','rôle insuffisant : seul un organisateur fait évoluer un cran');
  END IF;
  IF NOT api.verifier_pin(v_code, p_pin) THEN
    RETURN jsonb_build_object('ok',false,'error','pin invalide');
  END IF;
  INSERT INTO parcours.etat (voyage_id, etat, maj_at)
  VALUES (p_voyage_id, p_etat, now())
  ON CONFLICT (voyage_id) DO UPDATE SET etat = EXCLUDED.etat, maj_at = now();
  RETURN jsonb_build_object('ok',true);
END $$;
COMMENT ON FUNCTION api.parcours_enregistrer(bigint,jsonb,bigint,text) IS 'B-20 : persiste l''EtatParcours après vérif organisateur + PIN (autorité serveur, M048). {ok:false,error} si rôle/pin. PIN jamais renvoyé.';
GRANT EXECUTE ON FUNCTION api.parcours_enregistrer(bigint,jsonb,bigint,text) TO web_anon;

COMMIT;

-- ============================================================================
-- REQUÊTES D'ACCEPTATION (à jouer par B en DB2 après application au flip ; R1) :
-- \set org '(SELECT membre_id FROM membre.membre WHERE role=''owner'' LIMIT 1)'
-- \set org_code '(SELECT code_lien FROM membre.membre WHERE role=''owner'' LIMIT 1)'
-- \set org_pin '<pin owner réel, fourni par Guillaume, jamais journalisé>'
-- a) lire un voyage neuf -> NULL (le BFF seed)                 : SELECT api.parcours_lire(1);            -- (null)
-- b) enregistrer avec PIN faux -> refus                        : SELECT api.parcours_enregistrer(1,'{}'::jsonb,:org,'0000'); -- {ok:false,error:pin invalide}
-- c) enregistrer avec rôle non-org -> refus                    : SELECT api.parcours_enregistrer(1,'{}'::jsonb,(SELECT membre_id FROM membre.membre WHERE role='enfant' LIMIT 1),:'org_pin'); -- {ok:false,error:rôle...}
-- d) enregistrer org+PIN bon -> ok, puis lire rend le blob     : SELECT api.parcours_enregistrer(1,'{"voyage_id":1}'::jsonb,:org,:'org_pin'); SELECT api.parcours_lire(1);
-- e) grants                                                    : SELECT has_function_privilege('web_anon','api.parcours_lire(bigint)','EXECUTE');  -- t
-- NB : nettoyer la ligne de test (DELETE FROM parcours.etat WHERE voyage_id=1) si le voyage 1 n'est pas réel.
-- ============================================================================
