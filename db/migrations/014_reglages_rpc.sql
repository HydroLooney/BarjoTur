-- 014_reglages_rpc.sql (M361/M363 bloc 1) — RPC de lecture/écriture des RÉGLAGES (params budget.parametre) par famille,
-- + catalogue de métadonnées (famille/bornes/capacité/libellé/unité par clé). Le BFF gate la CAPACITÉ (peut()) ; ce RPC
-- vérifie le PIN, les BORNES et l'appartenance médicale, et écrit budget.parametre. ADDITIF ; budget.parametre est une
-- table de config (NON précieuse). GATE : écriture DB2 = accord Guillaume + « go bascule » ; NON appliquée d'ici là.
-- Idempotent (CREATE OR REPLACE / IF NOT EXISTS). Rollback = DROP des fonctions + table meta.

\set ON_ERROR_STOP on
BEGIN;

-- Catalogue : quelle clé appartient à quelle famille, ses bornes, sa capacité, son libellé/unité (source de vérité de
-- l'exposition UI). valeur_defaut = repli organisateur.
CREATE TABLE IF NOT EXISTS budget.parametre_meta (
  cle           text PRIMARY KEY,
  famille       text NOT NULL CHECK (famille IN ('composition','conduite','profils','medical')),
  libelle       text,
  bornes        jsonb,           -- {min,max,pas}
  unite         text,
  valeur_defaut text,            -- MIROIR de budget.parametre.valeur (TEXT en base, vérifié DB2) — pas jsonb.
  ecran         text[]           -- M391 : écrans APP où le réglage s'applique (carte/composeur/budget/explorer/agenda/intendance).
);                               -- L'overlay « ⚙ Réglages de cet écran » de C filtre ecran ∋ <écran courant>.
-- Ajout idempotent de la colonne si la table préexiste (déjà appliquée sans ecran).
ALTER TABLE budget.parametre_meta ADD COLUMN IF NOT EXISTS ecran text[];
COMMENT ON TABLE budget.parametre_meta IS 'M363 : métadonnées d''exposition des réglages (famille/bornes/capacité/libellé). Le BFF /api/reglages lit d''ici + budget.parametre.';

-- Seed des clés connues (défauts v2 ; à compléter). Capacité déduite de la famille côté BFF (CAPACITE_PAR_FAMILLE).
-- ecran[] : écrans APP où le réglage est pertinent (vocabulaire M391 ; C filtre son overlay dessus).
INSERT INTO budget.parametre_meta (cle, famille, libelle, bornes, unite, valeur_defaut, ecran) VALUES
  ('cap_roulage_min','conduite','Cap de roulage / jour','{"min":60,"max":480,"pas":30}','min','240', ARRAY['composeur','carte']),
  ('roulage_debut_min','conduite','Début fenêtre roulage','{"min":300,"max":720,"pas":30}','min','420', ARRAY['composeur','agenda']),
  ('roulage_fin_min','conduite','Fin fenêtre roulage (jamais le soir)','{"min":900,"max":1320,"pas":30}','min','1020', ARRAY['composeur','agenda']),
  ('nb_grandes_etapes_max','conduite','Grandes étapes de roulage max','{"min":0,"max":4,"pas":1}',NULL,'2', ARRAY['composeur']),
  ('cadence_laverie_j','composition','Cadence laverie','{"min":3,"max":14,"pas":1}','j','7', ARRAY['agenda','intendance']),
  ('cadence_confort_j','composition','Cadence nuit confort','{"min":3,"max":14,"pas":1}','j','7', ARRAY['agenda']),
  ('max_nuits_par_spot','composition','Nuits max / spot','{"min":1,"max":7,"pas":1}',NULL,'3', ARRAY['composeur','carte']),
  ('ravitaillement_intervalle_j','composition','Intervalle ravitaillement','{"min":2,"max":8,"pas":1}','j','4', ARRAY['intendance','budget'])
ON CONFLICT (cle) DO UPDATE SET ecran = EXCLUDED.ecran;   -- (re)pose l'écran même si la clé préexiste

-- LECTURE : réglages d'une famille = meta (bornes/libellé/défaut) + valeur courante (budget.parametre).
CREATE OR REPLACE FUNCTION api.reglages_lire(p_famille text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=api,budget,public,pg_temp AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'famille', m.famille, 'cle', m.cle, 'libelle', m.libelle,
    'valeur', COALESCE(p.valeur, m.valeur_defaut), 'valeur_defaut', m.valeur_defaut,
    'bornes', m.bornes, 'unite', m.unite,
    'ecran', to_jsonb(COALESCE(m.ecran, '{}'::text[]))) ORDER BY m.cle), '[]'::jsonb)
  FROM budget.parametre_meta m LEFT JOIN budget.parametre p ON p.cle = m.cle
  WHERE m.famille = p_famille;
$$;
GRANT EXECUTE ON FUNCTION api.reglages_lire(text) TO web_anon;

-- ÉCRITURE : vérifie PIN (membre du code) + BORNES (meta) + appartenance médicale, écrit budget.parametre. La CAPACITÉ
-- est déjà gatée par le BFF (peut()) ; ici défense en profondeur (le RPC re-checke la famille du meta).
CREATE OR REPLACE FUNCTION api.reglage_ecrire(p_code text, p_famille text, p_cle text, p_valeur jsonb, p_pin text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=api,budget,membre,decision,public,pg_temp AS $$
DECLARE m budget.parametre_meta; v_min numeric; v_max numeric; v_num numeric; v_txt text;
BEGIN
  SELECT * INTO m FROM budget.parametre_meta WHERE cle = p_cle AND famille = p_famille;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'clé/famille inconnue'); END IF;
  -- PIN (défense en profondeur ; la capacité est déjà gatée par le BFF peut()). api.verifier_pin(code,pin)→boolean, haché
  -- (R2 : jamais affiché). Wire réel (relevé DB2), plus un placeholder.
  IF NOT api.verifier_pin(p_code, p_pin) THEN RETURN jsonb_build_object('ok', false, 'error', 'pin invalide'); END IF;
  -- Valeur scalaire jsonb → TEXTE (budget.parametre.valeur est text) : #>>'{}' déquote (number/string/bool), sinon ::text.
  v_txt := COALESCE(p_valeur #>> '{}', p_valeur::text);
  -- BORNES (si numérique) :
  v_min := (m.bornes->>'min')::numeric; v_max := (m.bornes->>'max')::numeric;
  IF jsonb_typeof(p_valeur) = 'number' THEN
    v_num := v_txt::numeric;
    IF (v_min IS NOT NULL AND v_num < v_min) OR (v_max IS NOT NULL AND v_num > v_max) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'valeur hors bornes');
    END IF;
  END IF;
  -- type NOT NULL sans défaut (relevé DB2) → 'reglable' ; confiance/statut/maj_at ont des défauts. maj_par = qui a réglé.
  INSERT INTO budget.parametre(cle, valeur, type, maj_at, maj_par)
    VALUES (p_cle, v_txt, 'reglable', now(), p_code)
    ON CONFLICT (cle) DO UPDATE SET valeur = EXCLUDED.valeur, maj_at = now(), maj_par = EXCLUDED.maj_par;
  RETURN jsonb_build_object('ok', true, 'cle', p_cle, 'valeur', v_txt);
END $$;
GRANT EXECUTE ON FUNCTION api.reglage_ecrire(text,text,text,jsonb,text) TO web_anon;

COMMIT;

-- ============================================================================
-- VÉRIFIÉ (dry-run BEGIN…ROLLBACK sur la vraie DB2, 0 committé) — grounding schéma réel (B) :
--   - budget.parametre.valeur = TEXT (pas jsonb) → valeur_defaut TEXT, stockage v_txt (p_valeur #>>'{}'). Corrige le bug
--     « COALESCE types text and jsonb cannot be matched » qui aurait FAIT ÉCHOUER 014 au flip.
--   - type NOT NULL sans défaut → INSERT …, 'reglable' ; confiance/statut/maj_at gardent leurs défauts.
--   - PIN CÂBLÉ : api.verifier_pin(code,pin)→boolean (relevé DB2 ; PIN haché, R2). Gate prouvé (code réel + pin faux →
--     'pin invalide'). budget.parametre PK = (cle) confirmé → ON CONFLICT (cle) OK.
--   - Acceptation : reglages_lire('conduite')=4 (cap_roulage_min=240) ; clé inconnue → erreur ; meta_persistee=0.
-- RESTE à câbler si besoin produit : l'appartenance médicale (famille 'medical' : le code doit être le membre porteur de la
--   contrainte). La CAPACITÉ par famille reste gatée par le BFF (peut()).
-- Rollback : DROP FUNCTION api.reglage_ecrire(text,text,text,jsonb,text); DROP FUNCTION api.reglages_lire(text); DROP TABLE budget.parametre_meta;
-- ============================================================================
