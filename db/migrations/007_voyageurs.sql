-- 007_voyageurs.sql (T039, M074 — pré-écrit ; NON exécuté ; à rejouer en DB2 au flip, règle DB2 owner-safe).
-- Pose l'ADMIN DES VOYAGEURS (A03/C05) : 1 lecture + 2 mutations sur `membre.membre` (identité/rôles/liens).
--
-- SURFACE : DB2 (norvege_v2, Bomp4rd). `membre.membre` est PRÉCIEUSE (identité vivante, comme decision/parcours/fige) :
-- elle N'ENTRE JAMAIS dans la sync B-15. Ces RPC ne créent aucune table, elles frontent la table existante.
-- Colonnes relevées (B, 2026-08-14) : membre_id, prenom, role, code_lien, pin_hash, actif, cree_at. PAS de voyage_id
-- ni de qualification physiques → le param p_voyage_id est porté pour la rejouabilité multi-voyage (A18 §7.3) mais ne
-- FILTRE pas encore (une seule tribu physiquement ; à câbler quand membre gagne voyage_id). Honnêteté R1 : documenté,
-- jamais silencieux. `qualification` (adulte/enfant) n'est pas portée → le BFF rend null.
--
-- AUTORITÉ SERVEUR (M048/M052) : les mutations vérifient que le DEMANDEUR (p_code_demandeur) est organisateur ET que
-- son PIN correspond (api.verifier_pin), avant de toucher la cible. Le PIN ne transite jamais dans une réponse.
-- Le rôle stocké par un changement est le vocabulaire CONTRAT ('organisateur'/'voyageur'/'demo'/'invite') : il
-- retraverse normaliserRole à l'identique (M052) ; l'ancien physique 'owner'/'mamie'/'enfant' se lit toujours normalisé.
-- INVARIANTS gardés : organisateur_principal est UNIQUE → ni attribuable (BFF), ni rétrogradable ici (RPC).
--
-- IDEMPOTENT (structure) : CREATE OR REPLACE. La régénération de lien n'est pas naturellement idempotente (nouveau
-- code aléatoire) → le rejeu applicatif est couvert par l'en-tête d'idempotence du BFF.
-- Usage (DB2, au flip) : psql "<dsn_db2>" -v ON_ERROR_STOP=1 -f db/migrations/007_voyageurs.sql

\set ON_ERROR_STOP on
BEGIN;

-- 1. Lecture de la tribu (organisateur seulement, gardé côté BFF via whoami). Rend les lignes brutes ; le BFF mappe
--    vers Voyageur et normalise le rôle (point unique M052). Ordre stable par membre_id.
CREATE OR REPLACE FUNCTION api.voyageurs_lire(p_voyage_id bigint)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=api,membre,public,pg_temp AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'membre_id', m.membre_id, 'prenom', m.prenom, 'role', m.role,
           'code_lien', m.code_lien, 'actif', m.actif) ORDER BY m.membre_id), '[]'::jsonb)
  FROM membre.membre m;  -- p_voyage_id non filtrant (pas de colonne) : documenté, rejouabilité multi-voyage
$$;
COMMENT ON FUNCTION api.voyageurs_lire(bigint) IS 'T039 : lignes membre brutes (BFF mappe+normalise). Gardé organisateur au BFF. p_voyage_id non filtrant tant que membre n''a pas de voyage_id.';
GRANT EXECUTE ON FUNCTION api.voyageurs_lire(bigint) TO web_anon;

-- Garde interne : le demandeur (par son lien) est-il organisateur, et son PIN est-il bon ? Rend le rôle ou NULL.
CREATE OR REPLACE FUNCTION api._org_ok(p_code_demandeur text, p_pin text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=api,membre,public,pg_temp AS $$
DECLARE v_role text;
BEGIN
  SELECT role INTO v_role FROM membre.membre WHERE code_lien = p_code_demandeur AND actif;
  IF v_role IS NULL OR v_role NOT IN ('owner','organisateur','organisateur_principal') THEN RETURN false; END IF;
  RETURN api.verifier_pin(p_code_demandeur, p_pin);
END $$;
COMMENT ON FUNCTION api._org_ok(text,text) IS 'T039 interne : demandeur organisateur ET PIN correct (autorité serveur).';

-- 2. Changer le rôle d'un voyageur cible. Refuse si demandeur non-organisateur/PIN faux, si la cible est le principal
--    (unique, non rétrogradable ici), ou si la cible est inconnue. Rend { ok, membre } (brut) ou { ok:false, error }.
CREATE OR REPLACE FUNCTION api.voyageur_role_changer(
  p_voyage_id bigint, p_membre_id_cible bigint, p_role text, p_code_demandeur text, p_pin text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=api,membre,public,pg_temp AS $$
DECLARE v_role_cible text; v_row jsonb;
BEGIN
  IF p_role NOT IN ('organisateur','voyageur','demo','invite') THEN
    RETURN jsonb_build_object('ok',false,'error','rôle non attribuable');
  END IF;
  IF NOT api._org_ok(p_code_demandeur, p_pin) THEN
    RETURN jsonb_build_object('ok',false,'error','rôle insuffisant ou pin invalide');
  END IF;
  SELECT role INTO v_role_cible FROM membre.membre WHERE membre_id = p_membre_id_cible AND actif;
  IF v_role_cible IS NULL THEN RETURN jsonb_build_object('ok',false,'error','cible inconnue'); END IF;
  IF v_role_cible IN ('owner','organisateur_principal') THEN
    RETURN jsonb_build_object('ok',false,'error','le principal ne peut être rétrogradé ici');
  END IF;
  UPDATE membre.membre SET role = p_role WHERE membre_id = p_membre_id_cible AND actif
  RETURNING jsonb_build_object('membre_id',membre_id,'prenom',prenom,'role',role,'code_lien',code_lien,'actif',actif)
  INTO v_row;
  RETURN jsonb_build_object('ok',true,'membre',v_row);
END $$;
COMMENT ON FUNCTION api.voyageur_role_changer(bigint,bigint,text,text,text) IS 'T039 : change le rôle d''une cible après vérif organisateur+PIN. Principal non rétrogradable. {ok,membre} brut ou {ok:false,error}.';
GRANT EXECUTE ON FUNCTION api.voyageur_role_changer(bigint,bigint,text,text,text) TO web_anon;

-- 3. Régénérer le lien perso d'une cible (nouveau code url-safe unique ; l'ancien cesse de résoudre). Vérif org+PIN.
CREATE OR REPLACE FUNCTION api.voyageur_lien_regenerer(
  p_voyage_id bigint, p_membre_id_cible bigint, p_code_demandeur text, p_pin text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=api,membre,public,pg_temp AS $$
DECLARE v_new text; v_exists boolean; v_row jsonb;
BEGIN
  IF NOT api._org_ok(p_code_demandeur, p_pin) THEN
    RETURN jsonb_build_object('ok',false,'error','rôle insuffisant ou pin invalide');
  END IF;
  PERFORM 1 FROM membre.membre WHERE membre_id = p_membre_id_cible AND actif;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','cible inconnue'); END IF;
  LOOP
    v_new := regexp_replace(encode(gen_random_bytes(9),'base64'), '[+/=]', '', 'g');  -- ~11-12 car. url-safe (pgcrypto)
    SELECT EXISTS(SELECT 1 FROM membre.membre WHERE code_lien = v_new) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  UPDATE membre.membre SET code_lien = v_new WHERE membre_id = p_membre_id_cible AND actif
  RETURNING jsonb_build_object('membre_id',membre_id,'prenom',prenom,'role',role,'code_lien',code_lien,'actif',actif)
  INTO v_row;
  RETURN jsonb_build_object('ok',true,'membre',v_row);
END $$;
COMMENT ON FUNCTION api.voyageur_lien_regenerer(bigint,bigint,text,text) IS 'T039 : régénère le code_lien d''une cible (unique, ancien invalidé) après vérif organisateur+PIN. {ok,membre} brut ou {ok:false,error}.';
GRANT EXECUTE ON FUNCTION api.voyageur_lien_regenerer(bigint,bigint,text,text) TO web_anon;

COMMIT;

-- ============================================================================
-- REQUÊTES D'ACCEPTATION (à jouer par B en DB2 après application au flip ; R1). Le PIN réel vient de Guillaume,
-- jamais journalisé. NE PAS afficher les code_lien réels dans un transcript.
-- \set org_code '(SELECT code_lien FROM membre.membre WHERE role=''owner'' LIMIT 1)'   -- ne pas imprimer
-- \set cible '(SELECT membre_id FROM membre.membre WHERE role IN (''mamie'',''enfant'') LIMIT 1)'
-- a) lire la tribu (>=1 membre, aucun pin_hash)     : SELECT jsonb_array_length(api.voyageurs_lire(1));
-- b) rôle avec PIN faux -> refus                     : SELECT api.voyageur_role_changer(1,:cible,'voyageur',:'org_code','0000'); -- {ok:false,error:rôle insuffisant ou pin invalide}
-- c) rôle non attribuable -> refus                   : SELECT api.voyageur_role_changer(1,:cible,'organisateur_principal',:'org_code','<pin>'); -- {ok:false,error:rôle non attribuable}
-- d) rétrograder le principal -> refus               : SELECT api.voyageur_role_changer(1,(SELECT membre_id FROM membre.membre WHERE role='owner' LIMIT 1),'voyageur',:'org_code','<pin>'); -- {ok:false,error:le principal...}
-- e) rôle org+PIN bon -> {ok:true,membre:{role:voyageur}} ; puis relire pour vérifier
-- f) régénérer lien org+PIN bon -> nouveau code_lien != ancien ; l'ancien ne résout plus (whoami NULL)
-- g) grants : SELECT has_function_privilege('web_anon','api.voyageurs_lire(bigint)','EXECUTE'); -- t (x3 fonctions)
-- NB : restaurer le rôle/lien d'origine des lignes de test après acceptation (données réelles de la tribu).
-- ============================================================================
