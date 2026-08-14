-- 003_sync_scaffold.sql (B-15, pré-écrit sur feu M037 — NON exécuté tant que A n'a pas livré le dump dérivées-seules).
-- Pose l'échafaudage de la sync DB1→DB2 owner-safe : schémas `stage` (aire de chargement jetable) et `sync`
-- (file de recompute), l'unicité d'osm_id sur poi.poi (clé naturelle du merge), et `poi.merge_from_stage`.
--
-- SURFACE : DB2 (norvege_v2, Bomp4rd). Écriture couverte par la règle DB2 permanente owner-safe (Guillaume, M034).
-- INVARIANT owner-safe (M037/M050) : ce fichier ne touche JAMAIS decision.*, membre.*, fige.*, parcours.*, ni les
-- votes/_hist. Seules les tables DÉRIVÉES transitent par la sync ; les PRÉCIEUSES vivent en DB2 uniquement.
--
-- IDEMPOTENT : CREATE ... IF NOT EXISTS + CREATE OR REPLACE. Rejouable sans effet de bord.
-- A DE PLUS À VALIDER : poi.poi est sa surface (schéma poi). La logique de merge ci-dessous (préserve
-- provenance='voyageur', upsert par osm_id) est proposée par B ; A confirme les colonnes au dump réel.
-- Usage (à B-15, après dump de A) : psql "<dsn_db2>" -v ON_ERROR_STOP=1 -f db/migrations/003_sync_scaffold.sql

\set ON_ERROR_STOP on
BEGIN;

-- 1. Schémas techniques de la sync.
CREATE SCHEMA IF NOT EXISTS stage;   -- aire de chargement du dump dérivées (jetable, tronquée à chaque sync).
CREATE SCHEMA IF NOT EXISTS sync;     -- métadonnées de sync (file de recompute).
COMMENT ON SCHEMA stage IS 'Aire de chargement jetable du dump dérivées DB1 (B-15). Aucune donnée précieuse.';
COMMENT ON SCHEMA sync  IS 'Métadonnées de sync DB1->DB2 (B-15) : file de recompute, journal.';

-- 2. File de recompute : ce qui reste à recalculer côté DB2 après un swap de dérivées (leçon C16 : cache A* périmé).
CREATE TABLE IF NOT EXISTS sync.recompute_queue (
  id         bigserial PRIMARY KEY,
  objet      text NOT NULL,               -- ex. 'mcda2.leg_astar_cache', 'fige.itineraire'
  raison     text NOT NULL,               -- ex. 'matrice rechargée', 'reward recalculé'
  demande_at timestamptz NOT NULL DEFAULT now(),
  fait_at    timestamptz                  -- NULL tant que non traité
);
COMMENT ON TABLE sync.recompute_queue IS 'B-15 : objets DB2 à recalculer après un swap de dérivées (idempotent, fait_at borne le traité).';

-- 3. Clé naturelle du merge POI : osm_id unique (vérifié 1994/1994 distincts). Permet l'upsert ON CONFLICT.
--    Partiel sur les non-voyageur : les ajouts voyageur peuvent en théorie partager un osm_id sans casser le merge dérivé.
CREATE UNIQUE INDEX IF NOT EXISTS poi_osm_id_derive_uidx
  ON poi.poi (osm_id)
  WHERE provenance IS DISTINCT FROM 'voyageur';
COMMENT ON INDEX poi.poi_osm_id_derive_uidx IS 'B-15 : unicité osm_id des POI dérivés (hors voyageur) pour l''upsert de merge.';

-- 4. Merge owner-safe des POI depuis stage.poi (image du poi.poi de DB1, dérivé, sans lignes voyageur).
--    Préserve les ajouts voyageur (provenance='voyageur', nés en DB2), upsert le reste par osm_id, et
--    N'EFFACE RIEN en silence : les POI dérivés de DB2 absents du stage sont RETOURNÉS pour revue (pas supprimés).
CREATE OR REPLACE FUNCTION poi.merge_from_stage()
RETURNS jsonb LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  v_maj      integer := 0;
  v_ins      integer := 0;
  v_voyageur integer := 0;
  v_orphelins jsonb;
BEGIN
  IF to_regclass('stage.poi') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'stage.poi absent : charger le dump dérivées avant le merge.');
  END IF;

  -- Compte des voyageur préservés (jamais touchés par le merge).
  SELECT count(*) INTO v_voyageur FROM poi.poi WHERE provenance = 'voyageur';

  -- UPDATE des POI dérivés déjà présents (match osm_id, hors voyageur) : recharge toutes les colonnes non-clé
  -- depuis le stage. Colonne à colonne = fragile ; on s'appuie sur l'identité de schéma stage.poi ≡ poi.poi
  -- (pg_dump de poi.poi en DB1). A valide la liste au dump ; ici on recharge le bloc "dérivé" complet.
  UPDATE poi.poi d SET
    nom = s.nom, categorie = s.categorie, sous_categorie = s.sous_categorie,
    geometrie_type = s.geometrie_type, geom = s.geom, zone_id = s.zone_id, region_id = s.region_id,
    presentation = s.presentation, description = s.description, acces_van = s.acces_van,
    fenetre_calme = s.fenetre_calme, honeypot = s.honeypot, cruise_expose = s.cruise_expose,
    temps_visite = s.temps_visite, score_interet = s.score_interet, score_frequentation = s.score_frequentation,
    score_mcda = s.score_mcda, methode_score = s.methode_score, tier_defaut = s.tier_defaut,
    tier_defaut_source = s.tier_defaut_source, provenance = s.provenance, votable = s.votable,
    exclu = s.exclu, hors_emprise = s.hors_emprise, motif_exclusion = s.motif_exclusion, tags = s.tags
  FROM stage.poi s
  WHERE d.osm_id = s.osm_id AND d.provenance IS DISTINCT FROM 'voyageur';
  GET DIAGNOSTICS v_maj = ROW_COUNT;

  -- INSERT des POI dérivés nouveaux (osm_id du stage absent de DB2).
  INSERT INTO poi.poi (osm_id, nom, categorie, sous_categorie, geometrie_type, geom, zone_id, region_id,
                       presentation, description, acces_van, fenetre_calme, honeypot, cruise_expose, temps_visite,
                       score_interet, score_frequentation, score_mcda, methode_score, tier_defaut,
                       tier_defaut_source, provenance, votable, exclu, hors_emprise, motif_exclusion, tags)
  SELECT s.osm_id, s.nom, s.categorie, s.sous_categorie, s.geometrie_type, s.geom, s.zone_id, s.region_id,
         s.presentation, s.description, s.acces_van, s.fenetre_calme, s.honeypot, s.cruise_expose, s.temps_visite,
         s.score_interet, s.score_frequentation, s.score_mcda, s.methode_score, s.tier_defaut,
         s.tier_defaut_source, s.provenance, s.votable, s.exclu, s.hors_emprise, s.motif_exclusion, s.tags
  FROM stage.poi s
  WHERE NOT EXISTS (SELECT 1 FROM poi.poi d WHERE d.osm_id = s.osm_id);
  GET DIAGNOSTICS v_ins = ROW_COUNT;

  -- Orphelins : POI dérivés de DB2 (hors voyageur) absents du stage. NON supprimés (R1, pas de destructif silencieux) :
  -- retournés pour revue explicite (A décide si retrait volontaire upstream ou anomalie de dump).
  SELECT COALESCE(jsonb_agg(jsonb_build_object('poi_id', d.poi_id, 'osm_id', d.osm_id, 'nom', d.nom)), '[]'::jsonb)
    INTO v_orphelins
  FROM poi.poi d
  WHERE d.provenance IS DISTINCT FROM 'voyageur'
    AND NOT EXISTS (SELECT 1 FROM stage.poi s WHERE s.osm_id = d.osm_id);

  RETURN jsonb_build_object('ok', true, 'maj', v_maj, 'inseres', v_ins,
                            'voyageur_preserves', v_voyageur,
                            'orphelins_a_revoir', v_orphelins);
END $$;
COMMENT ON FUNCTION poi.merge_from_stage() IS 'B-15 : merge owner-safe stage.poi -> poi.poi (upsert par osm_id, préserve voyageur, orphelins retournés non supprimés).';

COMMIT;

-- ============================================================================
-- NOTES DE PRÉ-ÉCRITURE (à lever au dump réel de A) :
-- - stage.poi est supposé image du poi.poi de DB1 (pg_dump). Si A livre un sous-ensemble de colonnes ou un COPY,
--   ajuster la liste des colonnes UPDATE/INSERT ci-dessus (A valide, c'est sa surface poi).
-- - Idem pour les autres tables dérivées (matrice_base_base, cost_temps, bases_v2, poi_f_v2, reward_inputs,
--   ways_*, découpage) : elles se rechargent par TRUNCATE+INSERT depuis stage.<table> dans sync-db1-db2.sh,
--   pas ici (ce fichier ne scaffolde que les POI + la file de recompute).
-- ============================================================================
