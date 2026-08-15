-- 013_conducteur_et_contraintes_medicales.sql (M349) — gouvernance conduite + contraintes médicales par voyageur.
-- ADDITIF owner-safe (patron 010/011), sur le schéma PRÉCIEUX `membre` : (1) colonne `conducteur` ; (2) table
-- `membre.contrainte_medicale` (donnée SENSIBLE, ≤3/membre, éditable par la personne). Non destructif (lignes existantes
-- conducteur=false ; principal organisateur passé à true). La re-sync v3 ne touche JAMAIS ces objets (denylist `membre.`
-- de sync-recompute-v3.sh) : ce sont des données utilisateur, comme les votes.
--
-- GATE : écriture DB2 = accord DIRECT Guillaume (en place) + signal « go bascule » M. NON appliquée d'ici là ; à jouer au
-- dump final avec le reste. Idempotent (IF NOT EXISTS / CREATE OR REPLACE). Rollback = DROP COLUMN/TABLE/FUNCTION.
--
-- Usage (au go bascule) : cat db/migrations/013_*.sql | ssh bomp4rd "docker exec -i norvege-db psql -U norvege -d norvege_v2 -v ON_ERROR_STOP=1"

\set ON_ERROR_STOP on
BEGIN;

-- 1. CAPACITÉ CONDUCTEUR : attribut sur le membre. L'organisateur principal (Guillaume) = true par défaut.
ALTER TABLE membre.membre ADD COLUMN IF NOT EXISTS conducteur boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN membre.membre.conducteur IS 'M349 : peut régler la CONDUITE (transits, grandes étapes, cap/fenêtres, autonomie) si aussi organisateur. cf capacité regler_conduite (shared role.ts).';
-- Principal organisateur = conducteur. R1 (relevé DB2) : membre.role vaut {demo, enfant, mamie, OWNER} — PAS le Role
-- canonique shared (organisateur_principal/organisateur/…). L'organisateur principal (Guillaume) = `owner`. On cible donc
-- 'owner' (+ noms canoniques pour forward-compat). ⚠️ INCOHÉRENCE role DB2 vs shared/role.ts signalée à M (B128).
UPDATE membre.membre SET conducteur = true WHERE role IN ('owner', 'organisateur_principal', 'organisateur');

-- 2. CONTRAINTES MÉDICALES par voyageur (SENSIBLE) : ≤3/membre, la borne autonomie du composeur = MIN agrégé (M349 §2).
CREATE TABLE IF NOT EXISTS membre.contrainte_medicale (
  contrainte_id  serial PRIMARY KEY,
  membre_id      int NOT NULL REFERENCES membre.membre(membre_id) ON DELETE CASCADE,
  type           text NOT NULL CHECK (type IN ('electricite_nuit','refrigeration','sanitaires','autre')),
  max_nuits_autonomie_consecutives int,   -- borne d'autonomie (NULL si la contrainte ne borne pas l'autonomie)
  created_at     timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE membre.contrainte_medicale IS 'M349 : contraintes médicales par voyageur (<=3), SENSIBLE. Le composeur consomme l''AGRÉGAT (MIN de max_nuits_autonomie_consecutives sur voyageurs actifs), jamais le détail nominatif. Écriture gardée : la personne ou l''organisateur principal.';
CREATE INDEX IF NOT EXISTS idx_contrainte_medicale_membre ON membre.contrainte_medicale(membre_id);

-- Garde-fou <=3 contraintes / membre (MAX_CONTRAINTES_MEDICALES=3, shared).
CREATE OR REPLACE FUNCTION membre.contrainte_medicale_max3() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT count(*) FROM membre.contrainte_medicale WHERE membre_id = NEW.membre_id) >= 3 THEN
    RAISE EXCEPTION 'Au plus 3 contraintes médicales par membre (MAX_CONTRAINTES_MEDICALES).';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_contrainte_medicale_max3 ON membre.contrainte_medicale;
CREATE TRIGGER trg_contrainte_medicale_max3 BEFORE INSERT ON membre.contrainte_medicale
  FOR EACH ROW EXECUTE FUNCTION membre.contrainte_medicale_max3();

-- Vue AGRÉGÉE non nominative pour le composeur (borne effective ; ne fuit pas qui a quoi).
CREATE OR REPLACE VIEW api.borne_autonomie AS
  SELECT min(cm.max_nuits_autonomie_consecutives) AS max_nuits_autonomie_consecutives
  FROM membre.contrainte_medicale cm
  JOIN membre.membre m ON m.membre_id = cm.membre_id
  WHERE cm.max_nuits_autonomie_consecutives IS NOT NULL;
COMMENT ON VIEW api.borne_autonomie IS 'M349 §2 : borne autonomie effective = MIN des contraintes (agrégat non nominatif). NULL = pas de borne médicale.';

COMMIT;

-- ============================================================================
-- ACCEPTATION (après application) :
--   a) SELECT conducteur FROM membre.membre WHERE role='organisateur';           -- true
--   b) INSERT 4e contrainte pour un membre → EXCEPTION (max 3).
--   c) SELECT * FROM api.borne_autonomie;                                          -- MIN (ex. 2 pour PPC Guillaume) ou NULL
-- Enforce côté BFF : toute mutation de réglage de conduite (transits, grandes étapes M347, cap/fenêtres, autonomie) gate
--   sur peut(role,'regler_conduite',qual,conducteur) (shared). Écriture d'une contrainte médicale gardée (la personne
--   elle-même ou l'organisateur principal ; valeur non exposée aux autres, R1 sensible).
-- Rollback : DROP VIEW api.borne_autonomie; DROP TABLE membre.contrainte_medicale; ALTER TABLE membre.membre DROP COLUMN conducteur;
-- ============================================================================
