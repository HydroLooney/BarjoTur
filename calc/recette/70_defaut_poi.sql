-- 70_defaut_poi.sql (tâche A-10 : méthode défaut/tiers reproductible ; alimente A-09 reward, φ et V).
-- Produit `mcda2.defaut_poi` : le tier PAR DÉFAUT (prior de vote V) + la confiance de source (φ) de CHAQUE POI,
-- de façon reproductible et honnête. C'est le prior AVANT le vote famille (que le vote peut écraser).
--
-- DÉCISION R1 (le point clé, vérifié sur les données 14/08) : le TIER et la QUALITÉ (mcda2.qualite_poi, OWA)
-- sont ORTHOGONAUX, on ne dérive PAS l'un de l'autre. Preuve : les S curés ont la qualité OWA la PLUS BASSE
-- (médiane 0,285 ; ex. Bryggen Bergen = S urbain UNESCO, faible naturalité mais incontournable). Le tier mesure
-- la RENOMMÉE / l'envie a priori (V dans la reward r = V^α·φ·ψ·Q) ; la qualité Q est un FACTEUR SÉPARÉ. Dériver
-- le tier de Q = double compte de Q dans la reward. Donc : tier = signal de SOURCE/renommée, jamais la qualité.
--
-- Les 676 POI sans tier sont tous des imports BULK non curés (catalogue 346, wemap 240, pdf 37, vault:* 52,
-- recherche 1 ; 0 pépite). Aucun signal de renommée individuelle. Prior honnête = NEUTRE 'B' (moyen), la
-- différenciation revient au vote famille + à ψ(thème) + Q(qualité) déjà présents dans la reward. Injecter la
-- catégorie (parc national, point de vue...) dans le tier doublerait ψ(thème) -> écarté (escaladé à M en option).
--
-- CONFIANCE φ par hiérarchie de source (guides > communauté croisée > bases officielles > web/agrégateur) :
--   guide papier / retour d'expérience / incontournable ....... 0,90  (curé, cité)
--   nasjonaleturistveger.no / turrutebasen (bases officielles)  0,75
--   pdf / vault:* (interne semi-curé) .......................... 0,55
--   proxy_reward (dérivé v2, circulaire tier<-reward) .......... 0,50  (PROVISOIRE, à recalculer, flag M)
--   catalogue / wemap / recherche (web, agrégateur) ............ 0,35
--
-- ways_van/poi.poi READ-ONLY : on n'écrit PAS poi.tier_defaut (donnée source). defaut_poi = couche DÉRIVÉE.
-- Reward lira defaut_poi (couche canonique unique tier+confiance). Idempotent (DROP+CREATE).
-- Usage : psql -h localhost -p 5433 -d norvege_routing -v ON_ERROR_STOP=1 -f calc/recette/70_defaut_poi.sql

\set ON_ERROR_STOP on
BEGIN;

DROP TABLE IF EXISTS mcda2.defaut_poi;
CREATE TABLE mcda2.defaut_poi (
  poi_id     bigint PRIMARY KEY,
  tier       text NOT NULL CHECK (tier IN ('S','A','B','T')),
  confiance  double precision NOT NULL CHECK (confiance BETWEEN 0 AND 1),
  methode    text NOT NULL,           -- source_curee | base_officielle | proxy_reward_v2_provisoire | defaut_neutre
  source_type text                    -- provenance brute (pour tracer / recalculer)
);

INSERT INTO mcda2.defaut_poi (poi_id, tier, confiance, methode, source_type)
SELECT p.poi_id,
       -- TIER : curé -> hérité ; NULL -> neutre 'B'. Jamais dérivé de la qualité.
       COALESCE(p.tier_defaut, 'B') AS tier,
       -- CONFIANCE φ : hiérarchie de source.
       CASE
         WHEN p.tier_defaut_source ~* '^(guide papier|retour d''exp|incontournable)' THEN 0.90
         WHEN p.tier_defaut_source ~* 'nasjonaleturistveger|turrutebasen'            THEN 0.75
         WHEN p.tier_defaut_source ~* '^proxy_reward'                                THEN 0.50
         WHEN p.source ~* '^(pdf|vault:)'                                            THEN 0.55
         WHEN p.source ~* '^(catalogue|wemap|recherche)'                             THEN 0.35
         ELSE 0.40
       END AS confiance,
       -- MÉTHODE : trace la nature de l'assignation (curé vs neutre vs provisoire).
       CASE
         WHEN p.tier_defaut IS NULL                            THEN 'defaut_neutre'
         WHEN p.tier_defaut_source ~* '^proxy_reward'          THEN 'proxy_reward_v2_provisoire'
         WHEN p.tier_defaut_source ~* 'turrutebasen|nasjonale' THEN 'base_officielle'
         ELSE 'source_curee'
       END AS methode,
       COALESCE(NULLIF(split_part(p.source,':',1),''), p.source) AS source_type
FROM poi.poi p
WHERE p.merged_into_poi_id IS NULL;   -- exclut les doublons soft-mergés (Varhaug 141/272, A-10)

COMMENT ON TABLE mcda2.defaut_poi IS
  'A-10 : tier par défaut (prior de vote V) + confiance de source (φ) par POI. Tier = renommée/source, '
  'ORTHOGONAL à mcda2.qualite_poi (Q, facteur séparé de la reward r=V^α·φ·ψ·Q). 676 non curés = neutre B. '
  '70_defaut_poi.sql. proxy_reward = provisoire (dérivé v2, à recalculer).';

COMMIT;

-- Vérifications (verification-before-completion).
\echo '== defaut_poi : répartition tier x méthode =='
SELECT methode, tier, count(*), round(avg(confiance)::numeric,2) conf_moy
FROM mcda2.defaut_poi GROUP BY 1,2 ORDER BY 1,2;
\echo '== les 676 non curés sont-ils tous neutres B ? =='
SELECT count(*) AS n_neutre_B FROM mcda2.defaut_poi WHERE methode='defaut_neutre' AND tier='B';
\echo '== couverture : defaut_poi couvre tous les POI vivants (hors soft-merged) ? =='
SELECT (SELECT count(*) FROM poi.poi WHERE merged_into_poi_id IS NULL) AS poi_vivants,
       (SELECT count(*) FROM mcda2.defaut_poi) AS defaut_poi_lignes;
\echo '== R1 : tier vs qualité restent orthogonaux (pas de corrélation imposée) — moyenne qualité par tier =='
SELECT d.tier, count(q.poi_id) n_qual, round(avg(q.qualite)::numeric,3) qual_moy
FROM mcda2.defaut_poi d LEFT JOIN mcda2.qualite_poi q ON q.poi_id=d.poi_id
GROUP BY 1 ORDER BY 1;
