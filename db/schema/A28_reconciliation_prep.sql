-- A28_reconciliation_prep.sql — SCHÉMA DE PRÉPARATION de la réconciliation POI (M130/A28).
-- ⚠️ PREP UNIQUEMENT — NE PAS EXÉCUTER pendant le recompute (données non consolidées). Additif, versionné, idempotent.
-- Pose le terrain : POI enrichi (provenance + description + signal communauté par langue), matching/dédup, photos, circuits.
-- Aucune fusion aveugle (patron M111 au cas par cas). Garde anti-double-comptage : UN canal fixe le tier ; circuit/zone = coup de pouce PLAFONNÉ.
-- Exécution à la passe d'enrichissement, sur brief M.

-- 1. POI enrichi : colonnes additives (contenu éditorial + wikipédia).
ALTER TABLE poi.poi ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE poi.poi ADD COLUMN IF NOT EXISTS ce_qu_il_sen_dit text;         -- synthèse « ce qu'on en dit »
ALTER TABLE poi.poi ADD COLUMN IF NOT EXISTS wikipedia_url text;
ALTER TABLE poi.poi ADD COLUMN IF NOT EXISTS wikipedia_resume text;
ALTER TABLE poi.poi ADD COLUMN IF NOT EXISTS nom_no text;                    -- nom norvégien normalisé (matching)

-- 2. Provenance PAR CANAL (guides, communauté, base existante). n_sources + endossement gradué + score original + drapeau.
CREATE TABLE IF NOT EXISTS poi.poi_provenance (
  poi_id int NOT NULL,
  canal text NOT NULL,                          -- 'guide_papier' | 'communaute' | 'base_v2' | 'wikipedia' ...
  source text,                                  -- guide précis / plateforme
  n_sources int DEFAULT 1,
  endossement text,                             -- coup_de_coeur | section | itineraire | mention | (rien)
  cran text,                                    -- cran de tier dérivé de l'emphase (T/S/A/B/…)
  score_original numeric,                       -- note d'origine si la source en donne
  drapeau_desaccord boolean DEFAULT false,      -- conflit entre sources → à trancher
  PRIMARY KEY (poi_id, canal, source)
);

-- 3. Signal communauté PAR LANGUE/AIRE (scandinave, nl-de, fr-be, anglophone, russophone).
CREATE TABLE IF NOT EXISTS poi.poi_signal_communaute (
  poi_id int NOT NULL,
  aire_langue text NOT NULL,                    -- AireLangue (shared 36b91ad) : scandinave|nl_de|fr_be|anglophone|russophone
  n_sources_independantes int DEFAULT 0,
  endossement numeric,                          -- intensité agrégée [0..1]
  perle boolean DEFAULT false,                  -- « perle » / hors des radars
  liens jsonb,                                  -- sources (urls) par aire
  PRIMARY KEY (poi_id, aire_langue)
);

-- 4. Table de CORRESPONDANCE (matching d'un lieu entrant → POI existant). Jamais de fusion aveugle (M111).
CREATE TABLE IF NOT EXISTS poi.poi_reconciliation_match (
  entrant_id text NOT NULL,                     -- id du lieu entrant (source enrichissement)
  poi_id int,                                   -- POI existant apparié (NULL si nouveau)
  verdict text NOT NULL,                        -- 'match' | 'nouveau' | 'a_verifier'
  score_match numeric,                          -- similarité (nom norm + nom_no + proximité géo + type)
  distance_m numeric,
  motif text,
  PRIMARY KEY (entrant_id)
);

-- 5. Photos (priorité Wikimedia Commons ; licence + attribution obligatoires, R1).
CREATE TABLE IF NOT EXISTS poi.poi_photo (
  id bigserial PRIMARY KEY,
  poi_id int NOT NULL,
  source text,                                  -- 'wikimedia_commons' | ...
  licence text,                                 -- ex. CC-BY-SA-4.0
  attribution text,
  legende text,
  url_ou_chemin text NOT NULL
);

-- 6. Circuits (contrat A23) + propositions communauté.
CREATE TABLE IF NOT EXISTS mcda2.circuit (
  circuit_id bigserial PRIMARY KEY,
  nom text, mode_origine text, duree_min int, source_guide text, page text, endossement text
);
CREATE TABLE IF NOT EXISTS mcda2.circuit_membre (
  circuit_id bigint NOT NULL, poi_id int NOT NULL, ordre int NOT NULL,
  PRIMARY KEY (circuit_id, ordre)
);
CREATE TABLE IF NOT EXISTS mcda2.circuit_proposition (
  id bigserial PRIMARY KEY, nom text, aire_langue text, liens jsonb, source text
);

-- 6bis. Correspondance votes/préférences v2→v3 (A30/M138). Le map POI = merged_into_poi_id (M111) ; ici la traçabilité
--       du remap + les cas retirés (JAMAIS supprimés, historisés + drapeau). Dimensions neuves = neutres/vides (leximin).
CREATE TABLE IF NOT EXISTS decision.poi_vote_remap (
  poi_source int NOT NULL,                       -- POI d'origine du vote (v2)
  poi_canonique int,                             -- survivant après dédup (= merged_into ou lui-même) ; NULL si retiré
  statut text NOT NULL,                          -- 'fusionne' | 'conserve' | 'retire' | 'nouveau'
  historique jsonb,                              -- vote d'origine préservé (retire = tracé, jamais perdu)
  a_verifier boolean DEFAULT false,              -- cas douteux → arbitrage Guillaume avant bascule
  PRIMARY KEY (poi_source)
);
COMMENT ON TABLE decision.poi_vote_remap IS 'A30/M138 : remap votes v2→v3 sur POI canoniques (patron M111). retire=historisé+drapeau jamais supprimé ; tier 6 codes identité ; curseurs esprit 1:1 ; dimensions neuves neutres. Exécution enrichissement sur backup zéro-perte.';

-- 7. Garde anti-double-comptage : fusion tier re-tunable (poids en registre). STUB (log-odds / Dempster simplifié).
--    accord = évidence, absence = neutre, conflit = drapeau. À implémenter à l'enrichissement (poids CRITIC figés registre).
CREATE OR REPLACE FUNCTION mcda2.fusion_tier_stub(poi int) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT NULL::text;   -- placeholder : la vraie fusion vient à la passe d'enrichissement (A22), poids registre versionné
$$;
COMMENT ON FUNCTION mcda2.fusion_tier_stub IS 'STUB A22/M130 : fusion réputation par canal (log-odds), un seul canal fixe le tier ; circuit/zone = coup de pouce plafonné. À implémenter à l''enrichissement.';
