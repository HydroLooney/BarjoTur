-- 002_rpc_memoire_perso.sql (tâche loop, débloque B-17/B-18/C-16/C-17 ; spec B024 validée M026).
-- Pose la couche RPC de MÉMOIRE PERSO (exploration, collections, intendance) manquante en DB2 (B a vérifié
-- à la source R1 : aucune fonction api.* ne matche explor|collection|intendance ; le BFF est passe-plat, rien
-- à fronter tant que la RPC n'existe pas).
--
-- SURFACE : DB2 (surface servie), comme la migration 001. DB1 (norvege_routing) n'a ni schéma api ni
-- membre.membre (vérifié : seules mcda2/poi/diffusion/decoupage y vivent) : ces objets sont DB2. J'AUTORISE
-- l'écriture par MIGRATION ; l'application en DB2 reste la main unique de B (M018). Je livre le fichier + les
-- requêtes d'acceptation ; B applique et vérifie en DB2.
--
-- IDENTITÉ (constant, A03/M010/M026) : la clé est le `code_lien`, JAMAIS le PIN. Mémoire perso non destructive
-- = gating lien seul (le PIN ne gate que l'écriture PARTAGÉE, hors sujet ici). Résolution comme migration 001 :
--   SELECT membre_id FROM membre.membre WHERE code_lien=code AND actif.
--
-- PLACEMENT : schéma `membre` (état perso lié à l'identité, clé membre_id), tables `membre.exploration` /
-- `membre.collection`. Le contrat stable reste `api.*` (Q11) : le schéma sous-jacent est refactorable derrière
-- la RPC sans casser B/C. Intendance = collection générique (cle='intendance', contenu jsonb) : pas de table
-- dédiée (spec B024, on durcira si besoin).
--
-- IDEMPOTENT : CREATE TABLE IF NOT EXISTS + CREATE OR REPLACE FUNCTION. Rejouable sans effet de bord.
-- Usage (DB2) : psql "<dsn_db2>" -v ON_ERROR_STOP=1 -f db/migrations/002_rpc_memoire_perso.sql

\set ON_ERROR_STOP on
BEGIN;

-- 1. Tables de mémoire perso (clé membre_id ; PK naturelle ; maj_at pour le versioning léger côté sync).
CREATE TABLE IF NOT EXISTS membre.exploration (
  membre_id integer NOT NULL REFERENCES membre.membre(membre_id) ON DELETE CASCADE,
  osm_id    text    NOT NULL,
  statut    text    NOT NULL CHECK (statut IN ('vu','explore')),
  maj_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (membre_id, osm_id)
);
COMMENT ON TABLE membre.exploration IS 'Mémoire perso d''exploration (B-17) : par voyageur, statut vu/exploré d''un POI. Gating code_lien, non destructif.';

CREATE TABLE IF NOT EXISTS membre.collection (
  membre_id integer NOT NULL REFERENCES membre.membre(membre_id) ON DELETE CASCADE,
  cle       text    NOT NULL,
  contenu   jsonb   NOT NULL DEFAULT '{}'::jsonb,
  maj_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (membre_id, cle)
);
COMMENT ON TABLE membre.collection IS 'Mémoire perso générique (B-18/C-16/C-17) : un blob jsonb versionné par (voyageur, clé). Intendance = cle=intendance. Backend = sync/backup du MVP client-local.';

-- 2. Exploration : lire (liste des marques) + marquer (upsert idempotent).
CREATE OR REPLACE FUNCTION api.exploration_lire(code text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=api,membre,public,pg_temp AS $$
DECLARE v_membre integer;
BEGIN
  SELECT membre_id INTO v_membre FROM membre.membre WHERE code_lien=code AND actif;
  IF v_membre IS NULL THEN RETURN jsonb_build_object('ok',false,'error','code inconnu'); END IF;
  RETURN jsonb_build_object('ok',true,'marques', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('osm_id',e.osm_id,'statut',e.statut,'maj_at',e.maj_at) ORDER BY e.maj_at DESC)
    FROM membre.exploration e WHERE e.membre_id=v_membre), '[]'::jsonb));
END $$;
COMMENT ON FUNCTION api.exploration_lire(text) IS 'B-17 : marques d''exploration du voyageur (code_lien). {ok,marques:[{osm_id,statut,maj_at}]}.';
GRANT EXECUTE ON FUNCTION api.exploration_lire(text) TO web_anon;

CREATE OR REPLACE FUNCTION api.exploration_marquer(code text, p_osm_id text, p_statut text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=api,membre,public,pg_temp AS $$
DECLARE v_membre integer;
BEGIN
  SELECT membre_id INTO v_membre FROM membre.membre WHERE code_lien=code AND actif;
  IF v_membre IS NULL THEN RETURN jsonb_build_object('ok',false,'error','code inconnu'); END IF;
  IF p_osm_id IS NULL OR length(p_osm_id)=0 THEN RETURN jsonb_build_object('ok',false,'error','osm_id requis'); END IF;
  IF p_statut NOT IN ('vu','explore') THEN RETURN jsonb_build_object('ok',false,'error','statut invalide'); END IF;
  INSERT INTO membre.exploration (membre_id, osm_id, statut, maj_at)
  VALUES (v_membre, p_osm_id, p_statut, now())
  ON CONFLICT (membre_id, osm_id) DO UPDATE SET statut=EXCLUDED.statut, maj_at=now();
  RETURN jsonb_build_object('ok',true);
END $$;
COMMENT ON FUNCTION api.exploration_marquer(text,text,text) IS 'B-17 : upsert idempotent d''une marque vu/exploré. Gating code_lien, non destructif.';
GRANT EXECUTE ON FUNCTION api.exploration_marquer(text,text,text) TO web_anon;

-- 3. Collections perso (générique, sert aussi l'intendance via cle='intendance') : lire + écrire.
CREATE OR REPLACE FUNCTION api.collection_lire(code text, p_cle text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=api,membre,public,pg_temp AS $$
DECLARE v_membre integer; v_contenu jsonb;
BEGIN
  SELECT membre_id INTO v_membre FROM membre.membre WHERE code_lien=code AND actif;
  IF v_membre IS NULL THEN RETURN jsonb_build_object('ok',false,'error','code inconnu'); END IF;
  IF p_cle IS NULL OR length(p_cle)=0 THEN RETURN jsonb_build_object('ok',false,'error','cle requise'); END IF;
  SELECT contenu INTO v_contenu FROM membre.collection WHERE membre_id=v_membre AND cle=p_cle;
  RETURN jsonb_build_object('ok',true,'contenu', v_contenu);   -- contenu NULL si la collection n'existe pas encore
END $$;
COMMENT ON FUNCTION api.collection_lire(text,text) IS 'B-18/C-16 : lit un blob perso jsonb par (voyageur, clé). {ok,contenu} (contenu null si absent).';
GRANT EXECUTE ON FUNCTION api.collection_lire(text,text) TO web_anon;

CREATE OR REPLACE FUNCTION api.collection_ecrire(code text, p_cle text, p_contenu jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=api,membre,public,pg_temp AS $$
DECLARE v_membre integer;
BEGIN
  SELECT membre_id INTO v_membre FROM membre.membre WHERE code_lien=code AND actif;
  IF v_membre IS NULL THEN RETURN jsonb_build_object('ok',false,'error','code inconnu'); END IF;
  IF p_cle IS NULL OR length(p_cle)=0 THEN RETURN jsonb_build_object('ok',false,'error','cle requise'); END IF;
  INSERT INTO membre.collection (membre_id, cle, contenu, maj_at)
  VALUES (v_membre, p_cle, COALESCE(p_contenu,'{}'::jsonb), now())
  ON CONFLICT (membre_id, cle) DO UPDATE SET contenu=EXCLUDED.contenu, maj_at=now();
  RETURN jsonb_build_object('ok',true);
END $$;
COMMENT ON FUNCTION api.collection_ecrire(text,text,jsonb) IS 'B-18/C-16/C-17 : upsert idempotent d''un blob perso jsonb (sync/backup du MVP client-local).';
GRANT EXECUTE ON FUNCTION api.collection_ecrire(text,text,jsonb) TO web_anon;

COMMIT;

-- ============================================================================
-- REQUÊTES D'ACCEPTATION (à jouer par B en DB2 après application ; R1 verification-before-completion).
-- Attendu documenté en commentaire à droite.
-- ============================================================================
-- \set c '(SELECT code_lien FROM membre.membre WHERE role=''owner'' LIMIT 1)'
--
-- -- a) code inconnu -> enveloppe d'erreur propre (clé 'error', pas 'erreur')
-- SELECT api.exploration_lire('___inconnu___');                 -- {"ok":false,"error":"code inconnu"}
-- -- b) marquer puis relire (idempotence : rejouer 2x ne duplique pas, statut écrasé)
-- SELECT api.exploration_marquer(:c,'w123456','vu');            -- {"ok":true}
-- SELECT api.exploration_marquer(:c,'w123456','explore');       -- {"ok":true}  (upsert)
-- SELECT api.exploration_lire(:c);                              -- {"ok":true,"marques":[{"osm_id":"w123456","statut":"explore",...}]}
-- SELECT api.exploration_marquer(:c,'w123456','n_importe_quoi');-- {"ok":false,"error":"statut invalide"}
-- -- c) collection générique + intendance
-- SELECT api.collection_lire(:c,'intendance');                  -- {"ok":true,"contenu":null}
-- SELECT api.collection_ecrire(:c,'intendance','{"repas":[]}'); -- {"ok":true}
-- SELECT api.collection_lire(:c,'intendance');                  -- {"ok":true,"contenu":{"repas":[]}}
-- -- d) grants effectifs
-- SELECT has_function_privilege('web_anon','api.exploration_lire(text)','EXECUTE');  -- t
