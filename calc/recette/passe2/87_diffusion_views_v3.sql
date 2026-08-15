-- 87_diffusion_views_v3.sql
-- BarjoTur / Worker A — M263 #1 : vues de diffusion carto (spec B088, pour Martin/tuiles MVT).
-- STAGE push-button : DDL prete, s'embarque au dump final Passe 2 (gatee). Backup des vues avant remplacement.
-- R1 : champs reels seulement ; les champs absents de la donnee sont signales (pas fabriques).
--   NOTE : DROP+CREATE (pas REPLACE) car on change type/ordre de colonnes existantes.
--   Backup des definitions avant de figer (a jouer au dump final) :
--     CREATE TABLE IF NOT EXISTS staging.diffusion_viewdefs_pre_v3 AS
--       SELECT relname, pg_get_viewdef(oid,true) def FROM pg_class
--       WHERE relnamespace='diffusion'::regnamespace AND relname LIKE 'v_web_%';
--   Gerer les dependances (DROP ... si vues dependantes ; Martin lit ces vues).

-- ── v_web_poi : + categorie_calque (17 buckets), sous_categorie, tier_defaut, votable, cluster_count
DROP VIEW IF EXISTS diffusion.v_web_poi;
CREATE VIEW diffusion.v_web_poi AS
SELECT
  p.poi_id, p.nom, p.categorie, p.type_entite, p.region_id, p.zone_id,
  rp.tier, round(rp.v_poi::numeric,3) AS v_poi, rp.q, coalesce(rp.tres_frequente,false) AS tres_frequente,
  NULLIF(p.sous_categorie,'')  AS sous_categorie,
  p.tier_defaut, p.votable,
  p.score_frequentation        AS cluster_count,   -- R1 : proxy (pas de vrai cluster_count en base ; score_frequentation)
  CASE lower(trim(p.categorie))
    WHEN 'point de vue' THEN 'point_de_vue' WHEN 'belvedere' THEN 'point_de_vue'
    WHEN 'repere' THEN 'point_de_vue' WHEN 'paroi' THEN 'point_de_vue' WHEN 'point-interet' THEN 'point_de_vue'
    WHEN 'cascade' THEN 'cascade' WHEN 'glacier' THEN 'glacier' WHEN 'fjord' THEN 'fjord'
    WHEN 'nature' THEN 'nature' WHEN 'vallee' THEN 'nature' WHEN 'lac' THEN 'nature'
    WHEN 'parc national' THEN 'parc_national' WHEN 'plage' THEN 'plage' WHEN 'ile' THEN 'ile'
    WHEN 'rando' THEN 'rando' WHEN 'ville' THEN 'ville' WHEN 'village' THEN 'ville' WHEN 'quartier' THEN 'ville'
    WHEN 'musee' THEN 'culture' WHEN 'eglise' THEN 'culture' WHEN 'monument' THEN 'culture' WHEN 'patrimoine' THEN 'culture'
    WHEN 'manger' THEN 'restauration' WHEN 'cafe' THEN 'restauration' WHEN 'brasserie' THEN 'restauration' WHEN 'sortir' THEN 'restauration'
    WHEN 'dormir' THEN 'hebergement' WHEN 'activite' THEN 'activite' WHEN 'sauna' THEN 'activite'
    WHEN 'festival' THEN 'activite' WHEN 'shopping' THEN 'activite'
    WHEN 'route panoramique' THEN 'route' WHEN 'route_touristique' THEN 'route' WHEN 'route' THEN 'route'
    WHEN 'train-panoramique' THEN 'route' WHEN 'itineraire-velo' THEN 'route' WHEN 'circuit_ville' THEN 'route'
    WHEN 'aire_design' THEN 'aire' WHEN 'phare' THEN 'phare' ELSE 'autre'
  END AS categorie_calque,
  p.geom
FROM mcda2.reward_poi rp JOIN poi.poi p ON p.poi_id = rp.poi_id;

-- ── v_web_bases : distincte de v_web_bases_ideales. nuits_max_faisable = bases_v2.nuitees_max (deja en base !)
--    tier_moyen = tier moyen (numerique via facteur_avis) des POI atteignables 90min de la base.
CREATE OR REPLACE VIEW diffusion.v_web_bases AS
SELECT b.base_id, b.nom,
       (SELECT round(avg(lib.facteur_avis(rp.tier))::numeric,3)
        FROM staging.base_poi_reachable r JOIN mcda2.reward_poi rp ON rp.poi_id=r.poi_id
        WHERE r.base_id=b.base_id) AS tier_moyen,
       b.nuitees_max AS nuits_max_faisable,
       b.autonomie_nature, b.confort, b.geom
FROM mcda2.bases_v2 b;

-- ── v_web_circuits : R1 : circuits n'ont NI tier NI votable en base -> exposes NULL (a enrichir Passe 2).
-- R1 : circuit.distance_km VIDE (0/14) ET geom = POINT (pas de ligne) -> distance non derivable ici.
--      A renseigner en Passe 2 avec la geometrie ligne des circuits (meme lacune que "circuits en lignes").
CREATE OR REPLACE VIEW diffusion.v_web_circuits AS
SELECT c.circuit_id, c.nom,
       c.distance_km,                 -- R1 : NULL en source (a enrichir Passe 2)
       c.denivele_m AS denivele_pos,
       NULL::text    AS tier_defaut,   -- R1 : absent (circuits non tieres)
       NULL::boolean AS votable,       -- R1 : absent
       c.geom
FROM poi.circuit c;

-- ── v_web_sentiers : deja definie sur Turrutebasen ; on garde la difficulte officielle (82_).
--    (rappel : la vue existante derive difficulte de fotruteinfo.gradering — conforme spec B088.)

-- Contrôles de forme (dry) — a lancer sans figer si besoin :
--   SELECT count(*), count(categorie_calque), count(sous_categorie) FROM diffusion.v_web_poi;
--   SELECT count(*), count(nuits_max_faisable), count(tier_moyen) FROM diffusion.v_web_bases;
--   SELECT count(*) FROM diffusion.v_web_circuits;
