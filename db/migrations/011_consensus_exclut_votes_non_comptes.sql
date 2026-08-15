-- 011_consensus_exclut_votes_non_comptes.sql (M188 §1 — votesComptent gating du budget-temps).
-- Le consensus doit IGNORER les votes/appétits des liens votesComptent=false (shared/src/role.ts : portée suggestion
-- → rôle `demo`, votesComptent=false ; vitrine → `invite`, sans capacité `voter`). La base consensus
-- (decision._vote_base, lue par api.base_vote_weight) exclut DÉJÀ `demo` inline. Mais api.budget_temps_poi (008b/009)
-- agrégeait avis (vote_lieu) ET appétit (appetit_thematique) SANS ce filtre → un lien suggestion aurait skewé les
-- durées proposées du groupe (fuite latente : activite.poi vide en pré-dump, mais le membre `demo` existe déjà).
--
-- Ce correctif pose UNE seule vérité de la règle — decision.role_vote_compte(role) — et la câble dans les deux CTE.
-- On ne modifie PAS decision._vote_base (autre surface, déjà correcte pour `demo`) ; alignement recommandé à M
-- (adopter role_vote_compte() aussi côté _vote_base pour couvrir `invite` explicitement — équivalent en pratique,
-- `invite` n'ayant pas la capacité voter, cf CAPACITES_PAR_ROLE.invite=[]).
--
-- SURFACE : DB2 (norvege_v2, Bomp4rd). Additif (nouveau helper) + CREATE OR REPLACE de MA fonction (009). Non précieux.
-- IDEMPOTENT : CREATE OR REPLACE partout. Rollback = rejouer 009 (budget_temps_poi sans filtre) + DROP du helper.
-- Usage (DB2, depuis la racine) : cat db/migrations/011_*.sql | ssh bomp4rd "docker exec -i norvege-db psql -U norvege -d norvege_v2 -v ON_ERROR_STOP=1"

\set ON_ERROR_STOP on
BEGIN;

-- Règle unique « ce lien/rôle compte-t-il dans le consensus ? » — alignée sur PORTEE_DEFAUT.votesComptent (shared).
-- votesComptent=false ⇔ rôle demo (portée suggestion) ou invite (portée vitrine). Pur, aucune donnée.
CREATE OR REPLACE FUNCTION decision.role_vote_compte(p_role text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(p_role, '') NOT IN ('demo', 'invite');
$$;
COMMENT ON FUNCTION decision.role_vote_compte(text) IS 'M188 : vrai si les votes/appétits du rôle comptent dans le consensus (faux pour demo/invite, votesComptent=false). Source unique de la règle votesComptent (shared/src/role.ts).';

-- 008b/011 : budget-temps POI avec modulation réelle ET gating votesComptent (exclut demo/invite des DEUX agrégats).
CREATE OR REPLACE FUNCTION api.budget_temps_poi(p_poi_id int)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=api,activite,decision,poi,membre,lib,public,pg_temp AS $$
  WITH a AS (SELECT * FROM activite.poi WHERE poi_id = p_poi_id),
  -- avis agrégé égalitariste : moyenne de lib.facteur_avis(code) sur les MEMBRES QUI COMPTENT ayant classé ce POI.
  av AS (
    SELECT COALESCE(avg(lib.facteur_avis(vl.tier)), 1.0) AS f_avis
    FROM a
    JOIN poi.poi p ON p.poi_id = a.poi_id
    JOIN decision.vote_lieu vl ON vl.poi_osm_id = p.osm_id
    JOIN membre.membre m ON m.membre_id = vl.membre_id AND decision.role_vote_compte(m.role)
  ),
  -- appétit groupe égalitariste : par membre QUI COMPTE, moyenne de son appétit sur les thèmes ; puis moyenne des membres.
  ap AS (
    SELECT lib.facteur_appetit(COALESCE(avg(pm.app), 0)) AS g_appetit
    FROM (
      SELECT at.membre_id, avg(at.appetit) AS app
      FROM a, decision.appetit_thematique at
      JOIN membre.membre m ON m.membre_id = at.membre_id AND decision.role_vote_compte(m.role)
      WHERE at.theme = ANY(a.themes)
      GROUP BY at.membre_id
    ) pm
  )
  SELECT jsonb_build_object(
    'visite', jsonb_build_object(
      'min_min', a.min_min,
      'defaut_min', a.defaut_min,
      'max_min', a.max_min,
      'pas_min', 15,
      'granularite', a.granularite,
      'granularites', a.granularites,
      'duree_retenue_min', lib.duree_proposee(a.defaut_min, a.min_min, a.max_min, a.granularite, a.granularites, av.f_avis, ap.g_appetit),
      'source', CASE WHEN av.f_avis <> 1.0 OR ap.g_appetit <> 1.0 THEN 'preference' ELSE a.source END),
    'themes', to_jsonb(COALESCE(a.themes, '{}'::text[])))
  FROM a, av, ap;
$$;
COMMENT ON FUNCTION api.budget_temps_poi(int) IS 'M097/011 : budget-temps POI { visite, themes } avec modulation réelle (avis vote_lieu × appétit appetit_thematique, égalitariste) et gating votesComptent (exclut demo/invite via decision.role_vote_compte). NULL si POI sans budget/inconnu.';
GRANT EXECUTE ON FUNCTION api.budget_temps_poi(int) TO web_anon;

COMMIT;

-- ============================================================================
-- ACCEPTATION (R1) :
-- a) helper      : SELECT decision.role_vote_compte('demo'), decision.role_vote_compte('voyageur'); -- f, t
-- b) câblage     : SELECT count(*) FROM regexp_matches(pg_get_functiondef('api.budget_temps_poi(int)'::regprocedure), 'role_vote_compte','g'); -- 2
-- c) sonde       : server/recette/consensus-exclut-demo.sh (lecture seule) -> == PASS ==
-- Rollback : rejouer db/migrations/009_appetit_et_modulation.sql (budget_temps_poi sans filtre) puis
--            DROP FUNCTION decision.role_vote_compte(text);
-- ============================================================================
