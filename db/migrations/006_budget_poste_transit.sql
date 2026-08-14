-- 006_budget_poste_transit.sql (M058, pré-écrit — NON exécuté ; à rejouer en DB2 au flip, règle DB2 owner-safe).
-- Ajoute le poste « transit » à la SHAPE de api.budget_comparatif (A19 §8.4, M055/M058), pour que C l'affiche (C024).
--
-- SURFACE : couche CONTRAT api.* (pas de la donnée dérivée : les fonctions api.* sont posées par migration, jamais
-- dans le dump de sync B-15). Ne touche PAS le modèle mature `api.budget_variante` (M147/M148/M152).
--
-- STRUCTURE MAINTENANT, VALEUR AU CORRIDOR : la projection lit `b#>'{postes,transit,non_prudent}'` s'il existe (quand
-- budget_variante calculera le poste transit au corridor, agrégeant carburant/péages/ferry/nuits-autonomie des
-- SEGMENTS DE TRANSIT), sinon 0. Donc rien à recâbler ici quand la valeur arrive : elle est captée automatiquement.
-- Défaut nuits transit = autonomie (A19 §8.4), donc 0 € tant qu'aucun payant n'est choisi et aucun km transit routé.
--
-- IDEMPOTENT : CREATE OR REPLACE (préserve les GRANT existants). Rejouable sans effet de bord.
-- Usage (DB2, au flip) : psql "<dsn_db2>" -v ON_ERROR_STOP=1 -f db/migrations/006_budget_poste_transit.sql
-- NB shared : `BudgetPostes` (@barjotur/shared) doit recevoir `transit: number` (surface M) — demandé dans B037.

\set ON_ERROR_STOP on
BEGIN;

CREATE OR REPLACE FUNCTION api.budget_comparatif()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'api', 'fige', 'membre', 'pg_temp'
AS $function$
  WITH lignes AS (
    -- CONSENSUS (dernier figé consensus)
    SELECT 'consensus'::text AS source, NULL::bigint AS membre_id, NULL::text AS prenom,
           i.fige_id, i.code, i.label, i.archetype_key
    FROM fige.itineraire i WHERE i.est_consensus
    ORDER BY i.fige_at DESC LIMIT 1
  ), l2 AS (
    SELECT * FROM lignes
    UNION ALL
    -- DERNIÈRE proposition par VOTANT (fige avec auteur, la plus récente par membre)
    SELECT 'membre', i.membre_id, m.prenom, i.fige_id, i.code, i.label, i.archetype_key
    FROM fige.itineraire i JOIN membre.membre m ON m.membre_id = i.membre_id
    WHERE i.membre_id IS NOT NULL
      AND i.fige_at = (SELECT max(j.fige_at) FROM fige.itineraire j WHERE j.membre_id = i.membre_id)
    UNION ALL
    -- ARCHÉTYPES (dernière version par key)
    SELECT 'archetype', NULL, NULL, i.fige_id, i.code, i.label, i.archetype_key
    FROM fige.itineraire i WHERE i.est_archetype
      AND i.fige_at = (SELECT max(j.fige_at) FROM fige.itineraire j WHERE j.archetype_key = i.archetype_key AND j.est_archetype)
  ), enr AS (
    SELECT l2.*, api.budget_variante(l2.fige_id) AS b FROM l2
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'source', source, 'prenom', prenom, 'fige_id', fige_id, 'code', code, 'label', label, 'archetype_key', archetype_key,
    'km', b->'km', 'nuits', b->'nuits',
    -- colonnes postes (valeurs non prudentes pour le tableau ; le détail prudent/np est dans budget_variante)
    'postes', jsonb_build_object(
      'van',                b#>'{postes,van,eur}',
      'ferry_international', b#>'{postes,ferry_international,eur}',
      'ferry_interieur',    b#>'{postes,ferry_interieur,non_prudent}',
      'carburant',          b#>'{postes,carburant,non_prudent}',
      'hebergement',        b#>'{postes,hebergement,non_prudent}',
      'repas_courses',      b#>'{postes,repas_courses,non_prudent}',
      'activites',          b#>'{postes,activites,non_prudent}',
      -- Poste transit (M058) : agrégat des segments de transit. Valeur au corridor ; 0 tant qu'absent (autonomie).
      'transit',            COALESCE(b#>'{postes,transit,non_prudent}', to_jsonb(0))),
    'total_non_prudent_eur', b->'total_non_prudent_eur',
    'total_prudent_eur',     b->'total_prudent_eur',
    'par_adulte',            b->'par_adulte',
    'alertes',               b->'alertes'
  ) ORDER BY (CASE source WHEN 'consensus' THEN 0 WHEN 'membre' THEN 1 ELSE 2 END), prenom, archetype_key), '[]'::jsonb)
  FROM enr;
$function$;

GRANT EXECUTE ON FUNCTION api.budget_comparatif() TO web_anon;

COMMIT;

-- ACCEPTATION (au flip) :
-- SELECT jsonb_path_query_first(api.budget_comparatif(), '$[0].postes.transit');  -- 0 (ou la valeur si corridor livré)
