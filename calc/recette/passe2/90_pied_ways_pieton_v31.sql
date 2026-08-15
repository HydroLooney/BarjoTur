-- 90_pied_ways_pieton_v31.sql (M556 : périmètre (B), GO build) — RÉSEAU PIÉTON ROUTABLE v3.1 depuis le brut NVDB Elveg 2.0.
-- SOURCE = staging.ruteplan_links (2,24M liens NVDB NATIONAUX — PAS bornés à l'emprise : montent à ~71°N/Finnmark ; même source
--   qu'ways_ruteplan, filtrée « routier » au build). → CLIP EMPRISE 4 régions ici (staging.emprise_clip_25833, régions dissoutes
--   simplifiées 1km + buffer 2km, plafond ~65,5°N) car Guillaume : « seules les données dans l'emprise m'intéressent ». Le nord = poids
--   mort de toute façon (aucune base/POI hors emprise → jamais routé en last-leg), mais on respecte la contrainte dure + on allège.
-- PÉRIMÈTRE (B, M556) = DÉDIÉ piéton (Gang- og sykkelveg / Sti / Gangfelt / Sykkelveg) + VOIES CARROSSABLES MARCHABLES
--   (Enkel bilveg / Kanalisert veg / Rundkjøring / Rampe / Traktorveg), Tobler-coûté. Le dédié seul (785 km) est trop clairsemé
--   (last-leg base→POI + pied→arrêt TC échouerait) → on ajoute le carrossable marchable.
-- TOPOLOGIE : ways_ruteplan.id = ruteplan_links.linkid ET source/target = fromnode/tonode (vérifié 2 235 801/2 235 801) → on RÉUTILISE
--   fromnode/tonode comme source/target. AUCUN pgr_nodeNetwork/createTopology (réseau déjà nodé) → build léger (1 INSERT SELECT).
-- COÛT : cost_balade_s de mcda2.pied_cost_tobler (Tobler, pente ; ~1 m/s balade) où dispo (linkid) ; sinon FALLBACK PLAT length/V_PLAT_MS
--   (≈4 km/h) — concerne surtout ~9 098 liens piétons DÉDIÉS non couverts par le Tobler carrossable (has_tobler=false, traçable R1).
-- EXCLUSIONS : istunnel=1 (tunnels routiers = piéton interdit/dangereux) + isferry=1 (ferry ≠ pied). Piéton BIDIRECTIONNEL (oneway ignoré,
--   reverse_cost = cost). LIMITE R1 documentée : PAS d'exclusion « autoroute/motorveg » — aucun signal propre dans la donnée
--   (attributes vide ; funcroadclass=0 = riksveg marchables, pas des motorveg) → n'exclure par funcroadclass droperait 60k routes
--   marchables à tort ; les vraies motorveg (rares, piéton interdit) ne portent pas de last-leg → écart négligeable, à raffiner si signal.
-- Idempotent. Cadre : staging DB1 seulement (DB2 A* live inchangé, crible M avant re-sync owner-safe).
\set ON_ERROR_STOP on
\timing on
BEGIN;

DROP TABLE IF EXISTS staging.ways_pieton_v31;
CREATE TABLE staging.ways_pieton_v31 AS
SELECT
  l.linkid                                    AS id,
  l.fromnode                                  AS source,
  l.tonode                                    AS target,
  -- coût piéton = Tobler balade (s) si dispo, sinon fallback plat (length_m / 1.1 m/s ≈ 4 km/h)
  round( COALESCE(t.cost_balade_s, l.length / 1.1)::numeric , 2)  AS cost_s,
  round( COALESCE(t.cost_balade_s, l.length / 1.1)::numeric , 2)  AS reverse_cost_s,  -- bidirectionnel
  round(l.length::numeric, 2)                 AS length_m,
  l.roadtype                                  AS roadtype,
  (l.roadtype IN ('Gang- og sykkelveg','Sti','Gangfelt','Sykkelveg')) AS is_dedie,
  (t.id IS NOT NULL)                          AS has_tobler,    -- false = coût par fallback plat (R1)
  l.geom                                      AS geom
FROM staging.ruteplan_links l
LEFT JOIN mcda2.pied_cost_tobler t ON t.id = l.linkid
WHERE l.istunnel = 0 AND l.isferry = 0
  AND l.roadtype IN (
    'Gang- og sykkelveg','Sti','Gangfelt','Sykkelveg',      -- dédié piéton (14 501)
    'Enkel bilveg','Kanalisert veg','Rundkjøring','Rampe','Traktorveg'  -- carrossable marchable
  )
  AND ST_Intersects(l.geom, (SELECT geom FROM staging.emprise_clip_25833));  -- CLIP EMPRISE 4 régions (GiST ruteplan_links → rapide)

ALTER TABLE staging.ways_pieton_v31 ADD PRIMARY KEY (id);
CREATE INDEX ix_ways_pieton_v31_source ON staging.ways_pieton_v31 (source);
CREATE INDEX ix_ways_pieton_v31_target ON staging.ways_pieton_v31 (target);
CREATE INDEX ix_ways_pieton_v31_geom   ON staging.ways_pieton_v31 USING gist (geom);
ANALYZE staging.ways_pieton_v31;

COMMENT ON TABLE staging.ways_pieton_v31 IS
  'Réseau piéton routable v3.1 (M556 périmètre B) depuis NVDB Elveg 2.0 (staging.ruteplan_links). Dédié piéton + carrossable marchable, '
  'hors tunnels/ferries. Topologie fromnode/tonode réutilisée. Coût = Tobler cost_balade_s (has_tobler=true) sinon fallback plat 4 km/h. '
  'Piéton bidirectionnel. Limite R1 : pas d''exclusion motorveg (pas de signal propre). Staging DB1 ; substitue ways_pieton OSM sur DB2 après crible M.';

DO $$
DECLARE n_tot int; n_dedie int; n_tobler int; n_fallback int; km_tot numeric;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE is_dedie), count(*) FILTER (WHERE has_tobler),
         count(*) FILTER (WHERE NOT has_tobler), round(sum(length_m)::numeric/1000,0)
    INTO n_tot, n_dedie, n_tobler, n_fallback, km_tot FROM staging.ways_pieton_v31;
  RAISE NOTICE 'ways_pieton_v31 : % arêtes (% dédiées / % carrossables) | % Tobler + % fallback-plat | % km',
    n_tot, n_dedie, n_tot-n_dedie, n_tobler, n_fallback, km_tot;
END $$;

COMMIT;
