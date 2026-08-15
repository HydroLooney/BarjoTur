-- 78_bases_ideales_table.sql, table bases idéales = bases_v2 ANNOTÉES du diagnostic facility-location (M178) + reward/rayonnement.
-- N'invente pas de nouvelles bases (la couverture in-scope est déjà à 100% avec un sous-ensemble ; cf A075). Annote :
-- rang MCLP (ordre d'apport marginal de valeur), structurante (top 28 = 100% couverture), val_marginale, reward,
-- rayonnement, n_poi atteignables, drapeau zero_reward (couvre 0 POI scoré). Sert le dump + la vue v_web_bases_ideales (M208).
-- Usage : PGOPTIONS=... psql ... -f calc/recette/78_bases_ideales_table.sql
\set ON_ERROR_STOP on

DROP TABLE IF EXISTS mcda2.bases_ideales;
CREATE TABLE mcda2.bases_ideales AS
SELECT b.base_id, b.nom, b.region_id, b.lat, b.lon, b.geom,
       m.rang AS mclp_rang, m.val_marginale AS mclp_val_marginale,
       (m.rang IS NOT NULL AND m.rang <= 28) AS structurante,
       br.reward_atteignable AS reward, br.n_poi AS reward_n_poi,
       ray.rayonnement, ray.n_poi AS rayonnement_n_poi,
       (br.reward_atteignable = 0 OR br.reward_atteignable IS NULL) AS zero_reward,
       (SELECT count(DISTINCT poi_id) FROM staging.base_poi_reachable r WHERE r.base_id=b.base_id) AS n_poi_atteignables
FROM mcda2.bases_v2 b
LEFT JOIN staging.mclp_ordre m USING(base_id)
LEFT JOIN mcda2.base_reward br USING(base_id)
LEFT JOIN mcda2.base_rayonnement ray USING(base_id);
CREATE INDEX ON mcda2.bases_ideales(base_id);
CREATE INDEX ON mcda2.bases_ideales USING gist(geom);
COMMENT ON TABLE mcda2.bases_ideales IS 'Bases idéales (M178) = bases_v2 annotées du diagnostic facility-location : mclp_rang (apport marginal valeur, glouton), structurante (top 28 = 100% couverture in-scope), reward, rayonnement, zero_reward. Couverture in-scope déjà complète, aucune base ajoutée. 15/08.';

\echo '== bases_ideales : structurantes / redondantes / zero-reward =='
SELECT count(*) total, count(*) FILTER (WHERE structurante) structurantes, count(*) FILTER (WHERE mclp_rang IS NULL) redondantes_couverture, count(*) FILTER (WHERE zero_reward) zero_reward FROM mcda2.bases_ideales;
\echo '== empreinte bases_ideales =='
SELECT md5(string_agg(md5(t.*::text), '' ORDER BY base_id)) FROM (SELECT base_id, mclp_rang, structurante, reward, rayonnement, zero_reward FROM mcda2.bases_ideales) t;
