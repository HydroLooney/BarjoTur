-- 85_fix_hors_reseau.sql, CORRECTION PASSE 2 (obligatoire, M212) — NE PAS jouer avant la Passe 2.
-- Problème (A075 §4) : 83 POI scorés haute-valeur sont >2km du réseau fc≤5 (hors poi_contracte_tampon) donc comptés dans
-- le reward d'AUCUNE base, alors que des bases sont à 2-20km. Sous-compte les incontournables (Geiranger, Besseggen,
-- Lysefjord, Skageflå) = coeur du roadtrip. M212 : rattacher au noeud atteignable le plus proche, tampon ÉLARGI ciblé.
-- Méthode : pour les seuls POI hors-tampon, snap au noeud contracté le plus proche SANS plafond 2km (borne large 25km,
-- « dernier tronçon d'accès local/sentier/bateau » assumé), ajouter à un bridge étendu, REJOUER base_reward (gate C17).
-- À enchaîner avec l'enrichissement Passe 2 (A28/A30), puis re-run bases idéales + archétypes A31 → dump final.
\set ON_ERROR_STOP on

-- 1. POI scorés hors univers atteignable (>2km du réseau fc≤5)
DROP TABLE IF EXISTS staging.poi_hors_reseau;
CREATE TABLE staging.poi_hors_reseau AS
SELECT rp.poi_id FROM mcda2.reward_poi rp
WHERE rp.poi_id NOT IN (SELECT DISTINCT poi_id FROM staging.poi_contracte_tampon);
\echo '== POI hors-réseau à rattacher (attendu ~83) =='
SELECT count(*) FROM staging.poi_hors_reseau;

-- 2. bridge ÉTENDU : ces POI → noeud contracté le plus proche (borne 25km, dernier tronçon d'accès assumé)
INSERT INTO staging.poi_contracte_tampon(poi_id, node_van, cluster_key, v_poi)
SELECT hr.poi_id, s.node, ST_SnapToGrid(ST_Transform(p.geom,25833),50), rp.v_poi
FROM staging.poi_hors_reseau hr
JOIN poi.poi p USING(poi_id)
JOIN mcda2.reward_poi rp ON rp.poi_id=hr.poi_id
CROSS JOIN LATERAL (SELECT node FROM staging.van_contracte_node cn
                   ORDER BY cn.geom <-> ST_Transform(ST_PointOnSurface(p.geom),25833) LIMIT 1) s
WHERE ST_Distance(ST_Transform(ST_PointOnSurface(p.geom),25833),
      (SELECT cn.geom FROM staging.van_contracte_node cn ORDER BY cn.geom <-> ST_Transform(ST_PointOnSurface(p.geom),25833) LIMIT 1)) <= 25000;
\echo '== bridge étendu : POI hors-réseau désormais rattachés =='
SELECT count(DISTINCT poi_id) FROM staging.poi_contracte_tampon pt JOIN staging.poi_hors_reseau hr USING(poi_id);

-- 3. REJOUER base_reward (73_ tampon-frontière) sur le bridge étendu → base_reward_v6, gate C17 vs promu.
--    (relancer calc/recette/73_ après avoir pointé la sortie sur base_reward_v6, puis comparer corr vs base_reward promu ;
--     si raffinement attendu (fjords remontent), promouvoir avec backup ; re-run 76/77/78 bases idéales.)
\echo 'ETAPE 3 : relancer 73_ (sortie base_reward_v6) + 76/77/78, gate C17, promotion avec backup. Voir runbook Passe 2.'
