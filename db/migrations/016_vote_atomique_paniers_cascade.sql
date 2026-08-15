-- 016_vote_atomique_paniers_cascade.sql (M401/M407) — RPC atomiques du VOTE COMPLET, prêtes-à-appliquer au flip (lot 012-016).
-- Câble les 4 passe-plats du BFF (server/src/services/votes.ts) qui dégradent aujourd'hui en 42883 (siRpcAbsente) :
--   api.echanger_vote(code,retirer,poser,tier)   (M392) : échange ATOMIQUE retirer+poser au MÊME tier plein.
--   api.paniers_lire(code)                        (M396) : état des paniers { dans_budget (compté) vs hors_budget (NON
--                                                          compté), quota, a_reequilibrer } + budget_a_resoudre.
--   api.poser_hors_budget(code,poser,tier)        (M396) : voie (b) « régler plus tard » : parque le SURPLUS sans le compter.
--   api.cascade_declassement(code,tier)           (M396) : voie (a) : suite FINIE d'étapes { tier, vers, candidats }
--                                                          jusqu'au plancher B (sans quota) → termine toujours.
-- Le modèle PUR de référence = sidecar/quota_vote.py (echanger_vote / poser_hors_budget / etat_paniers / cascade_declassement).
--
-- ENFORCEMENT QUOTA : DÉJÀ porté par api.set_vote (hard = budget.p_num('quota_hard_'||tier), tiers T/S/A ; B = plancher
--   illimité). 016 NE le redouble PAS ; l'échange atomique préserve le compte du tier (retire 1, pose 1) → quota tenu.
-- HORS-BUDGET (R1, jamais compté silencieusement) : nouvelle table decision.vote_lieu_hors_budget, SÉPARÉE de
--   decision.vote_lieu. Le consensus (decision._vote_base, api.base_vote_weight), le budget-temps (api.budget_temps_poi)
--   et le composeur ne lisent QUE decision.vote_lieu → le surplus est exclu PAR CONSTRUCTION, pas par convention.
--
-- SURFACE : DB2 (norvege_v2, Bomp4rd). Additif : 1 table neuve + 4 fonctions (CREATE OR REPLACE). vote_lieu_hors_budget =
--   donnée utilisateur → PRÉCIEUX ; déjà couvert par la denylist du re-sync (regex `decision\.`). IDEMPOTENT.
-- GATE : appliqué au FLIP (go bascule). VÉRIFIÉ en DRY-RUN (BEGIN…ROLLBACK) sur la vraie DB2 : compile + s'exécute contre
--   le schéma et la donnée réels, RIEN de committé (0 persistance). Rollback définitif = DROP des 4 fonctions + de la table.
-- Usage (flip) : cat db/migrations/016_*.sql | ssh bomp4rd "docker exec -i norvege-db psql -U norvege -d norvege_v2 -v ON_ERROR_STOP=1"

\set ON_ERROR_STOP on
BEGIN;

-- ------------------------------------------------------------------------------------------------
-- Panier HORS-BUDGET : surplus accepté (voie b) mais JAMAIS compté (R1). Séparé de decision.vote_lieu.
-- ------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS decision.vote_lieu_hors_budget (
  membre_id  bigint      NOT NULL,
  poi_osm_id text        NOT NULL,
  tier       text        NOT NULL,
  maj_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (membre_id, poi_osm_id)
);
COMMENT ON TABLE decision.vote_lieu_hors_budget IS 'M396/016 : votes de lieu en SURPLUS (voie b « régler plus tard »), parqués hors budget. JAMAIS lus par le consensus / le budget-temps / le composeur → NON comptés (R1). Précieux (donnée utilisateur, denylist re-sync via decision.*).';

-- ------------------------------------------------------------------------------------------------
-- api.paniers_lire(code) → EtatPaniers { paniers:[PanierTier], budget_a_resoudre } (contrat shared vote.ts).
-- quota = budget.p_num('quota_hard_'||tier) (NULL pour B = plancher illimité). Code inconnu → paniers vides (shape stable).
-- ------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api.paniers_lire(code text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'api','decision','membre','budget','poi','pg_temp' AS $$
DECLARE mid bigint; paniers jsonb := '[]'::jsonb; tr text; q int; dans jsonb; hors jsonb; resoudre boolean := false;
BEGIN
  SELECT membre_id INTO mid FROM membre.membre WHERE code_lien=code AND actif;
  IF mid IS NULL THEN RETURN jsonb_build_object('paniers','[]'::jsonb,'budget_a_resoudre',false); END IF;
  FOREACH tr IN ARRAY ARRAY['T','S','A','B'] LOOP
    q := budget.p_num('quota_hard_'||tr);   -- NULL pour B (plancher illimité)
    dans := (SELECT COALESCE(jsonb_agg(jsonb_build_object('ref','p:'||vl.poi_osm_id,'osm_id',vl.poi_osm_id,'nom',p.nom)
                 ORDER BY p.nom),'[]'::jsonb)
             FROM decision.vote_lieu vl LEFT JOIN poi.poi p ON p.osm_id=vl.poi_osm_id
             WHERE vl.membre_id=mid AND vl.tier=tr);
    hors := (SELECT COALESCE(jsonb_agg(jsonb_build_object('ref','p:'||h.poi_osm_id,'osm_id',h.poi_osm_id,'nom',p.nom)
                 ORDER BY p.nom),'[]'::jsonb)
             FROM decision.vote_lieu_hors_budget h LEFT JOIN poi.poi p ON p.osm_id=h.poi_osm_id
             WHERE h.membre_id=mid AND h.tier=tr);
    IF jsonb_array_length(hors) > 0 THEN resoudre := true; END IF;
    paniers := paniers || jsonb_build_array(jsonb_build_object(
      'tier',tr, 'quota',q, 'dans_budget',dans, 'hors_budget',hors,
      'a_reequilibrer', jsonb_array_length(hors) > 0));
  END LOOP;
  RETURN jsonb_build_object('paniers',paniers,'budget_a_resoudre',resoudre);
END $$;
COMMENT ON FUNCTION api.paniers_lire(text) IS 'M396/016 : EtatPaniers { paniers:[{tier,quota|null,dans_budget[],hors_budget[],a_reequilibrer}], budget_a_resoudre }. hors_budget NON compté (R1). quota via budget.p_num(quota_hard_tier), NULL au plancher B.';
GRANT EXECUTE ON FUNCTION api.paniers_lire(text) TO web_anon;

-- ------------------------------------------------------------------------------------------------
-- api.echanger_vote(code,retirer,poser,tier) : échange ATOMIQUE (une transaction plpgsql) au MÊME tier plein.
-- Miroir de sidecar/quota_vote.echanger_vote : l'ancien DOIT être voté à ce tier ; compte inchangé → quota respecté.
-- ------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api.echanger_vote(code text, retirer text, poser text, p_tier text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'api','decision','membre','budget','poi','pg_temp' AS $$
DECLARE mid bigint; r_id text; p_id text; t text;
BEGIN
  SELECT membre_id INTO mid FROM membre.membre WHERE code_lien=code AND actif;
  IF mid IS NULL THEN RETURN jsonb_build_object('ok',false,'error','code inconnu'); END IF;
  t := nullif(btrim(COALESCE(p_tier,'')),'');
  IF t IS NULL THEN RETURN jsonb_build_object('ok',false,'error','tier invalide'); END IF;
  IF retirer IS NULL OR split_part(retirer,':',1)<>'p' OR position(':' in retirer)=0
     THEN RETURN jsonb_build_object('ok',false,'error','ref invalide'); END IF;
  IF poser   IS NULL OR split_part(poser,':',1)<>'p'   OR position(':' in poser)=0
     THEN RETURN jsonb_build_object('ok',false,'error','ref invalide'); END IF;
  r_id := substr(retirer, position(':' in retirer)+1);
  p_id := substr(poser,   position(':' in poser)+1);
  IF r_id='' OR p_id='' THEN RETURN jsonb_build_object('ok',false,'error','ref vide'); END IF;
  IF NOT EXISTS (SELECT 1 FROM decision.vote_lieu WHERE membre_id=mid AND poi_osm_id=r_id AND tier=t) THEN
    RETURN jsonb_build_object('ok',false,'error','echange_impossible','tier',t);
  END IF;
  DELETE FROM decision.vote_lieu WHERE membre_id=mid AND poi_osm_id=r_id AND tier=t;
  INSERT INTO decision.vote_lieu(membre_id,poi_osm_id,tier,maj_at) VALUES (mid,p_id,t,now())
    ON CONFLICT (membre_id,poi_osm_id) DO UPDATE SET tier=EXCLUDED.tier, maj_at=now();
  RETURN jsonb_build_object('ok',true,'action','echange','tier',t,'retirer',retirer,'poser',poser,'membre_id',mid,
    'budget', api.budget_vote(code)->'budgets', 'paniers', api.paniers_lire(code));
END $$;
COMMENT ON FUNCTION api.echanger_vote(text,text,text,text) IS 'M392/016 : échange atomique retirer+poser au même tier (compte inchangé → quota tenu). ok:false/echange_impossible si retirer non voté à ce tier. Rend budget + paniers.';
GRANT EXECUTE ON FUNCTION api.echanger_vote(text,text,text,text) TO web_anon;

-- ------------------------------------------------------------------------------------------------
-- api.poser_hors_budget(code,poser,tier) : voie (b). Parque le surplus dans decision.vote_lieu_hors_budget (NON compté).
-- ------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api.poser_hors_budget(code text, poser text, p_tier text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'api','decision','membre','budget','poi','pg_temp' AS $$
DECLARE mid bigint; p_id text; t text;
BEGIN
  SELECT membre_id INTO mid FROM membre.membre WHERE code_lien=code AND actif;
  IF mid IS NULL THEN RETURN jsonb_build_object('ok',false,'error','code inconnu'); END IF;
  t := nullif(btrim(COALESCE(p_tier,'')),'');
  IF t IS NULL THEN RETURN jsonb_build_object('ok',false,'error','tier invalide'); END IF;
  IF poser IS NULL OR split_part(poser,':',1)<>'p' OR position(':' in poser)=0
     THEN RETURN jsonb_build_object('ok',false,'error','ref invalide'); END IF;
  p_id := substr(poser, position(':' in poser)+1);
  IF p_id='' THEN RETURN jsonb_build_object('ok',false,'error','ref vide'); END IF;
  INSERT INTO decision.vote_lieu_hors_budget(membre_id,poi_osm_id,tier,maj_at) VALUES (mid,p_id,t,now())
    ON CONFLICT (membre_id,poi_osm_id) DO UPDATE SET tier=EXCLUDED.tier, maj_at=now();
  RETURN jsonb_build_object('ok',true,'action','set','ref',poser,'tier',t,'hors_budget',true,'membre_id',mid,
    'budget', api.budget_vote(code)->'budgets', 'paniers', api.paniers_lire(code));
END $$;
COMMENT ON FUNCTION api.poser_hors_budget(text,text,text) IS 'M396/016 : voie (b) « régler plus tard ». Parque le surplus dans decision.vote_lieu_hors_budget (NON compté, R1). Rend budget + paniers (a_reequilibrer=true).';
GRANT EXECUTE ON FUNCTION api.poser_hors_budget(text,text,text) TO web_anon;

-- ------------------------------------------------------------------------------------------------
-- api.cascade_declassement(code,tier) → EtapeCascade[] { tier, vers, candidats } (voie a). FINIE : s'arrête au premier
-- tier avec place, ou au plancher (dernier de l'ordre, sans quota). Miroir de sidecar/quota_vote.cascade_declassement.
-- ------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api.cascade_declassement(code text, p_tier text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'api','decision','membre','budget','poi','pg_temp' AS $$
DECLARE mid bigint; ordre text[] := ARRAY['T','S','A','B']; etapes jsonb := '[]'::jsonb;
        i int; tr text; vers text; q int; used int; cand jsonb;
BEGIN
  SELECT membre_id INTO mid FROM membre.membre WHERE code_lien=code AND actif;
  IF mid IS NULL THEN RETURN '[]'::jsonb; END IF;
  i := array_position(ordre, nullif(btrim(COALESCE(p_tier,'')),''));
  IF i IS NULL THEN RETURN '[]'::jsonb; END IF;
  WHILE i < array_length(ordre,1) LOOP     -- le dernier (B) = plancher illimité : on s'arrête avant
    tr := ordre[i]; vers := ordre[i+1];
    q := budget.p_num('quota_hard_'||tr);
    IF q IS NULL THEN EXIT; END IF;         -- pas de quota → de la place, stop
    SELECT count(*) INTO used FROM decision.vote_lieu WHERE membre_id=mid AND tier=tr;
    IF used < q THEN EXIT; END IF;          -- de la place à ce tier → stop
    cand := (SELECT COALESCE(jsonb_agg(jsonb_build_object('ref','p:'||vl.poi_osm_id,'osm_id',vl.poi_osm_id,'nom',p.nom)
                 ORDER BY p.nom),'[]'::jsonb)
             FROM decision.vote_lieu vl LEFT JOIN poi.poi p ON p.osm_id=vl.poi_osm_id
             WHERE vl.membre_id=mid AND vl.tier=tr);
    etapes := etapes || jsonb_build_array(jsonb_build_object('tier',tr,'vers',vers,'candidats',cand));
    i := i + 1;
  END LOOP;
  RETURN etapes;
END $$;
COMMENT ON FUNCTION api.cascade_declassement(text,text) IS 'M396/016 : voie (a) « rééquilibrer maintenant ». Suite FINIE d''étapes {tier,vers,candidats} pour faire de la place, jusqu''au plancher B (sans quota). candidats = les lieux du tier (choix de C).';
GRANT EXECUTE ON FUNCTION api.cascade_declassement(text,text) TO web_anon;

COMMIT;

-- ============================================================================
-- ACCEPTATION (R1) — vérifié en DRY-RUN (BEGIN…ROLLBACK) sur la vraie DB2, 0 persistance :
--   a) paniers    : SELECT jsonb_object_keys(api.paniers_lire(<code>));            -- paniers, budget_a_resoudre
--   b) échange KO : SELECT api.echanger_vote(<code>,'p:__x__','p:__y__','T')->>'error'; -- echange_impossible (rien voté)
--   c) cascade    : SELECT jsonb_typeof(api.cascade_declassement(<code>,'T'));      -- array
--   d) hors-budget: SELECT api.poser_hors_budget(<code>,'p:__probe__','A')->>'ok';  -- true (puis ROLLBACK)
--   e) R1 non-compté : decision.vote_lieu_hors_budget n'est référencée QUE par 016 (paniers_lire la lit, poser_hors_budget
--        l'écrit) — AUCUNE fonction du consensus/budget/composeur ne la touche.
--        (grep : SELECT count(*) FROM pg_proc WHERE pg_get_functiondef(oid) ILIKE '%vote_lieu_hors_budget%' → 2, les 2 RPC 016 seules).
-- Rollback : DROP FUNCTION api.{paniers_lire(text),echanger_vote(text,text,text,text),poser_hors_budget(text,text,text),
--            cascade_declassement(text,text)} ; DROP TABLE decision.vote_lieu_hors_budget.
-- ============================================================================
