-- 75_base_rayonnement.sql, base_rayonnement recomputé (A14) sur graphe van contracté fc≤5 + reachability tampon-frontière.
-- Rayonnement = accessibilité-qualité à décroissance (gravité) : R=45min horizon, lambda=25min décroissance exp.
-- rayonnement = Σ q_i·exp(-t_i/lambda) sur POI scorés atteints (cluster-dédup), t_i = temps van au POI (min sur noeuds tampon).
-- q_max = max q atteint, q_moy_pond = Σ(q·w)/Σw (w=exp(-t/lambda)), n_poi = clusters. q depuis mcda2.reward_poi (promu).
-- Backup-first, transactionnel. Usage : PGOPTIONS=... psql ... -f calc/recette/75_base_rayonnement.sql
\set ON_ERROR_STOP on

-- paramètres (repris v2 : R=45min, lambda=25min)
INSERT INTO mcda2.routing_params(profil,param,valeur,unite,description) VALUES
 ('van','rayonnement_R_min',45,'min','Horizon rayonnement (accessibilité-qualité décroissante)'),
 ('van','rayonnement_lambda_min',25,'min','Constante de décroissance exp du rayonnement')
ON CONFLICT DO NOTHING;

DROP TABLE IF EXISTS mcda2.base_rayonnement_v3;
CREATE TABLE mcda2.base_rayonnement_v3(base_id int, rayonnement numeric, n_poi int, q_max numeric, q_moy_pond numeric);
DO $$
DECLARE b RECORD;
  rmax int := (SELECT valeur*60 FROM mcda2.routing_params WHERE profil='van' AND param='rayonnement_R_min');
  lam  numeric := (SELECT valeur*60 FROM mcda2.routing_params WHERE profil='van' AND param='rayonnement_lambda_min');
BEGIN
  FOR b IN SELECT base_id, node_contracte FROM staging.base_contracte_node ORDER BY base_id LOOP
    INSERT INTO mcda2.base_rayonnement_v3
    WITH reached AS (  -- temps min par POI atteint (tampon-frontière), q depuis reward_poi
      SELECT pt.cluster_key, min(d.agg_cost) t, max(rp.q) q
      FROM pgr_drivingDistance('SELECT id, source, target, cost_s AS cost, reverse_cost_s AS reverse_cost FROM staging.ways_van_contracte',
             b.node_contracte, rmax, directed:=true) d
      JOIN staging.poi_contracte_tampon pt ON pt.node_van = d.node
      JOIN mcda2.reward_poi rp ON rp.poi_id = pt.poi_id
      GROUP BY pt.cluster_key
    ), w AS (SELECT q, exp(-t/lam) poids FROM reached)
    SELECT b.base_id,
           round(coalesce(sum(q*poids),0)::numeric,3),
           count(*)::int,
           round(coalesce(max(q),0)::numeric,3),
           round(coalesce(sum(q*poids)/nullif(sum(poids),0),0)::numeric,3)
    FROM w;
  END LOOP;
END $$;
CREATE INDEX ON mcda2.base_rayonnement_v3(base_id);

\echo '== base_rayonnement_v3 : distribution + corr vs v2 =='
SELECT count(*) bases, round(avg(rayonnement)::numeric,2) moy, round(max(rayonnement)::numeric,2) mx, round(avg(n_poi)::numeric,0) npoi_moy FROM mcda2.base_rayonnement_v3;
SELECT round(corr(v3.rayonnement, v2.rayonnement)::numeric,3) corr_v3_v2 FROM mcda2.base_rayonnement_v3 v3 JOIN mcda2.base_rayonnement v2 USING(base_id);

-- PROMOTION (backup-first, schéma canonique conservé : + params)
BEGIN;
DROP TABLE IF EXISTS staging.base_rayonnement_backup_pre_v3;
CREATE TABLE staging.base_rayonnement_backup_pre_v3 AS SELECT * FROM mcda2.base_rayonnement;
DELETE FROM mcda2.base_rayonnement;
INSERT INTO mcda2.base_rayonnement(base_id, rayonnement, n_poi, q_max, q_moy_pond, params)
SELECT base_id, rayonnement, n_poi, q_max, q_moy_pond, 'R=45min,lambda=25min,fc5+tampon_frontiere_2km,q_reward_poi_promu'
FROM mcda2.base_rayonnement_v3;
COMMENT ON TABLE mcda2.base_rayonnement IS 'CANONIQUE (promu 15/08). Accessibilité-qualité décroissante : Σ q·exp(-t/25min), horizon 45min, graphe van contracté fc≤5 + tampon-frontière 2km. q depuis reward_poi promu.';
COMMIT;
\echo '== CANONIQUE base_rayonnement promu + empreinte =='
SELECT count(*), round(avg(rayonnement)::numeric,2) FROM mcda2.base_rayonnement;
SELECT md5(string_agg(md5(t.*::text), '' ORDER BY base_id)) FROM (SELECT base_id, rayonnement, n_poi FROM mcda2.base_rayonnement) t;
