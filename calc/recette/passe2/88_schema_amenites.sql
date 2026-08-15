-- 88_schema_amenites.sql
-- BarjoTur / Worker A — M263/M271 : schema `amenites` v3 (from-scratch, doctrine M268).
-- Aménités van-life en PROFONDEUR de service, provenance PAR attribut (R1), hierarchie de sources.
-- STAGE : cree le schema + le modele. Ingestion (NVDB/annuaires/OSM) alimentee par 89_. Dump final = canonique.

CREATE SCHEMA IF NOT EXISTS amenites;
COMMENT ON SCHEMA amenites IS 'Amenites van-life v3 (bobilplass, camping, aire de repos, services) — profondeur de service + provenance par attribut. From-scratch (doctrine v3). Worker A.';

-- Table canonique : une ligne par amenite, attributs de service + provenance JSONB par attribut.
DROP TABLE IF EXISTS amenites.amenite CASCADE;
CREATE TABLE amenites.amenite (
  amenite_id      bigserial PRIMARY KEY,
  type            text NOT NULL,          -- bobilplass | camping | aire_repos
  nom             text,
  -- position
  geom            geometry(Point,4326) NOT NULL,
  -- SERVICES (bool/valeur ; NULL = inconnu, jamais invente)
  vidange_grises  boolean,                -- tommestasjon eaux grises
  vidange_noires  boolean,                -- WC chimique / eaux noires
  plein_eau       boolean,                -- vann / eau potable
  electricite     boolean,                -- borne elec
  laverie         boolean,
  douche          boolean,
  wc              boolean,
  wifi            boolean,
  prix_nok        integer,                -- prix indicatif/nuit (NULL si inconnu)
  saison          text,
  reservation     boolean,
  nb_places       integer,
  surface         text,                   -- dur | herbe | mixte
  note            numeric,                -- note/avis 0..5
  -- provenance : { "attribut": {"src":"NVDB|bobilavisen|bobilplassen|osm", "date":"YYYY-MM-DD"} }
  provenance      jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_pos      text,                   -- source de la position
  ext_ids         jsonb DEFAULT '{}'::jsonb,  -- {nvdb_id, osm_id, ...} pour dedup/tracabilite
  maj             date
);
CREATE INDEX amenite_geom_gix ON amenites.amenite USING gist(geom);
CREATE INDEX amenite_type_idx ON amenites.amenite(type);

COMMENT ON TABLE amenites.amenite IS 'Amenite van-life canonique v3. Services en profondeur, provenance PAR attribut (colonne provenance jsonb). NULL = inconnu (R1, jamais invente). Merge hierarchique NVDB(services autoritaires)>annuaires(confort)>OSM(base).';
COMMENT ON COLUMN amenites.amenite.provenance IS 'jsonb : source + date PAR attribut de service (R1). Ex {"vidange_grises":{"src":"NVDB","date":"2026-08-15"}}.';
COMMENT ON COLUMN amenites.amenite.vidange_grises IS 'Vidange eaux grises (NVDB tommestasjon autoritaire).';
COMMENT ON COLUMN amenites.amenite.plein_eau IS 'Plein eau potable (NVDB vann autoritaire).';
COMMENT ON COLUMN amenites.amenite.laverie IS 'Laverie (annuaires bobilavisen/bobilplassen, confort).';

-- Enregistrement au catalogue (dictionnaire) si meta.catalogue existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='meta' AND table_name='catalogue') THEN
    -- (schema du catalogue a confirmer ; insertion faite dans 89_ apres ingestion)
    RAISE NOTICE 'meta.catalogue present : enregistrement amenites.amenite a faire en 89_';
  END IF;
END $$;
