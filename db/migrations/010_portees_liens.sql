-- 010_portees_liens.sql (A34/M173/M176 — pré-écrit ; NON exécuté ; à appliquer en DB2 au GO, règle DB2 owner-safe).
-- Génération + révocation de liens d'invitation par PORTÉE (membre / suggestion / vitrine). Contrat shared/role.ts.
--
-- SURFACE : DB2. ADDITIF : 2 colonnes NULLABLES sur `membre.membre` (portee, espaces_visibles) — non destructif
-- (les lignes existantes restent NULL = membre plein) ; + 2 RPC. `membre.*` reste PRÉCIEUSE (hors sync B-15).
-- ROLE_PAR_PORTEE (shared) : membre→voyageur, suggestion→demo, vitrine→invite. Le `votesComptent` est PORTÉ PAR LE RÔLE
-- (le consensus ignore déjà demo/invite, comme aujourd'hui) : rien à recâbler dans l'agrégation des votes.
-- AUTORITÉ (M048) : générer/révoquer = organisateur + PIN (réutilise `api._org_ok`, posé en 007). PIN jamais renvoyé.
-- Un lien généré n'a PAS de PIN (voyageur/demo/invite ne font pas de mutation gatée PIN) : pin_hash reste NULL.
--
-- IDEMPOTENT : ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE. Rollback = DROP colonnes + fonctions.
-- Usage (DB2, au GO) : psql "<dsn_db2>" -v ON_ERROR_STOP=1 -f db/migrations/010_portees_liens.sql

\set ON_ERROR_STOP on
BEGIN;

ALTER TABLE membre.membre ADD COLUMN IF NOT EXISTS portee text;
ALTER TABLE membre.membre ADD COLUMN IF NOT EXISTS espaces_visibles text[];
COMMENT ON COLUMN membre.membre.portee IS 'A34 : portée du lien (membre|suggestion|vitrine) ; NULL = membre plein historique.';
COMMENT ON COLUMN membre.membre.espaces_visibles IS 'A34 : override des espaces visibles ; NULL = PORTEE_DEFAUT côté app.';

-- Générer un lien : organisateur + PIN → nouveau membre avec le rôle de la portée + un code_lien url-safe unique.
CREATE OR REPLACE FUNCTION api.voyageur_lien_generer(
  p_portee text, p_prenom text, p_espaces text[], p_code_org text, p_pin text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=api,membre,public,pg_temp AS $$
DECLARE v_role text; v_code text; v_id bigint; v_exists boolean;
BEGIN
  IF p_portee NOT IN ('membre','suggestion','vitrine') THEN
    RETURN jsonb_build_object('ok',false,'error','portée inconnue');
  END IF;
  IF NOT api._org_ok(p_code_org, p_pin) THEN
    RETURN jsonb_build_object('ok',false,'error','rôle insuffisant ou pin invalide');
  END IF;
  v_role := CASE p_portee WHEN 'membre' THEN 'voyageur' WHEN 'suggestion' THEN 'demo' ELSE 'invite' END;
  LOOP
    v_code := regexp_replace(encode(gen_random_bytes(9),'base64'), '[+/=]', '', 'g');
    SELECT EXISTS(SELECT 1 FROM membre.membre WHERE code_lien = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  SELECT COALESCE(max(membre_id),0)+1 INTO v_id FROM membre.membre;
  INSERT INTO membre.membre (membre_id, prenom, role, code_lien, actif, portee, espaces_visibles)
  VALUES (v_id, COALESCE(NULLIF(btrim(p_prenom),''),'Invité'), v_role, v_code, true, p_portee, p_espaces);
  RETURN jsonb_build_object('ok',true,'membre',
    jsonb_build_object('membre_id',v_id,'prenom',COALESCE(NULLIF(btrim(p_prenom),''),'Invité'),'role',v_role,
      'code_lien',v_code,'actif',true,'portee',p_portee,'espaces_visibles',p_espaces));
END $$;
COMMENT ON FUNCTION api.voyageur_lien_generer(text,text,text[],text,text) IS 'A34 : génère un lien (portée→rôle) après vérif organisateur+PIN. {ok,membre} ou {ok:false,error}. PIN jamais renvoyé.';
GRANT EXECUTE ON FUNCTION api.voyageur_lien_generer(text,text,text[],text,text) TO web_anon;

-- Révoquer un lien : organisateur + PIN → le code cesse de résoudre (actif=false ; whoami→NULL). Le principal protégé.
CREATE OR REPLACE FUNCTION api.voyageur_lien_revoquer(p_code_cible text, p_code_org text, p_pin text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=api,membre,public,pg_temp AS $$
DECLARE v_role_cible text;
BEGIN
  IF NOT api._org_ok(p_code_org, p_pin) THEN
    RETURN jsonb_build_object('ok',false,'error','rôle insuffisant ou pin invalide');
  END IF;
  SELECT role INTO v_role_cible FROM membre.membre WHERE code_lien = p_code_cible AND actif;
  IF v_role_cible IS NULL THEN RETURN jsonb_build_object('ok',false,'error','lien inconnu ou déjà révoqué'); END IF;
  IF v_role_cible IN ('owner','organisateur_principal') THEN
    RETURN jsonb_build_object('ok',false,'error','le lien de l''organisateur principal ne se révoque pas ici');
  END IF;
  UPDATE membre.membre SET actif = false WHERE code_lien = p_code_cible;
  RETURN jsonb_build_object('ok',true);
END $$;
COMMENT ON FUNCTION api.voyageur_lien_revoquer(text,text,text) IS 'A34 : révoque un lien (actif=false) après vérif organisateur+PIN. Principal non révocable. {ok} ou {ok:false,error}.';
GRANT EXECUTE ON FUNCTION api.voyageur_lien_revoquer(text,text,text) TO web_anon;

COMMIT;

-- ACCEPTATION (au GO, R1 ; PIN owner réel via Guillaume, jamais journalisé) :
-- a) générer un lien vitrine : SELECT api.voyageur_lien_generer('vitrine','Tante Alice',NULL,:'org_code',:'org_pin');
-- b) le nouveau code résout : SELECT api.whoami(<code renvoyé>) ->> 'role';  -- invite
-- c) révoquer : SELECT api.voyageur_lien_revoquer(<code>,:'org_code',:'org_pin'); puis whoami(<code>) -> NULL
-- d) PIN faux → refus ; e) grants web_anon x2. NB : supprimer les membres de test (DELETE ... WHERE portee IS NOT NULL AND prenom='Tante Alice').
