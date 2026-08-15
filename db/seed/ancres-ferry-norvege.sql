-- ancres-ferry-norvege.sql (M303 §1) — PROPOSITION de seed des ANCRES OBLIGATOIRES du voyage Norvège 2027.
-- NON APPLIQUÉE : à valider par M (schéma + valeurs), appliquée au flip avec l'accord DIRECT de Guillaume. Zéro écriture
-- DB2 tant que non validée. R1 : les dates/heures sont RÉELLES (réservation Fjord Line, M303) ; les valeurs marquées
-- « À CONFIRMER » (noeuds graphe des quais, budgets roulage précis) attendent A/Guillaume — je ne les invente pas.
--
-- Modèle proposé : une table `voyage.ancre` = les étapes obligatoires à date fixe que le composeur route AUTOUR sans
-- les déplacer (garde `plan_respecte_ancres`, horaires.py). Le domaine ROUTABLE du composeur = les 21 nuits sur site
-- (Kristiansand → ... → Kristiansand) ; les ferries A/R + le transit Allemagne sont EXTERNES au graphe Norvège
-- (Hirtshals/Allemagne hors réseau) : budget roulage seul, pas de routage A*.

\set ON_ERROR_STOP on
BEGIN;

CREATE SCHEMA IF NOT EXISTS voyage;
CREATE TABLE IF NOT EXISTS voyage.ancre (
  ancre_id          text PRIMARY KEY,
  kind              text NOT NULL CHECK (kind IN ('ferry','transit','restitution')),
  libelle           text NOT NULL,
  jalon_ts          timestamptz,          -- date/heure DURE (NULL si contrainte de jour seulement)
  jour              int  NOT NULL,        -- jour figé attendu (index 1..N), non déplaçable
  lieu              text,                 -- Kristiansand / Hirtshals / Schweighouse-sur-Moder
  base_node         int,                  -- noeud graphe du quai (pour l'A* d'approche) ; NULL si hors réseau
  heure_limite_min  int,                  -- arriver au quai AU PLUS TARD (minutes depuis minuit) ; NULL si pas d'heure
  budget_roulage_min  int,                -- budget de ROUTE (conduite) pour atteindre l'ancre ; NULL si non concerné
  budget_traversee_min int,               -- durée de TRAVERSÉE ferry (≠ roulage) ; NULL hors ferry (M305)
  ordre             int  NOT NULL,
  verrou            boolean NOT NULL DEFAULT true,  -- obligatoire, non déplaçable, verrouillé au fige
  a_confirmer       boolean NOT NULL DEFAULT false  -- valeur ESTIMÉE en attente du routage réel d'A (R1, honnête)
);
COMMENT ON TABLE voyage.ancre IS 'M303 : étapes obligatoires à date fixe (ferry A/R Fjord Line, transit Allemagne, restitution). Garde dure du composeur (plan_respecte_ancres).';

-- Ancres réelles (M303/M305). Dates/heures CONFIRMÉES ; budgets roulage/traversée = ESTIMATIONS a_confirmer:true (A
-- route Schweighouse→Hirtshals + fournit les nœuds quais KRS + la durée de traversée réelle Fjord Line). heure_limite :
-- 18h40=1120, 09h00=540. budget_roulage = conduite ; budget_traversee = temps de ferry (distincts, M305).
INSERT INTO voyage.ancre
  (ancre_id, kind, libelle, jalon_ts, jour, lieu, base_node, heure_limite_min, budget_roulage_min, budget_traversee_min, ordre, a_confirmer) VALUES
  ('transit_all_aller', 'transit',     'Transit Allemagne (aller)',                 NULL,                     0,  'Schweighouse-sur-Moder → Hirtshals', NULL, NULL, 900 /*≈2j*/, NULL,        1, true),
  ('ferry_aller',       'ferry',       'Ferry Fjord Line Hirtshals → Kristiansand', '2027-08-04 18:40:00+02', 1,  'Kristiansand',                       1168891 /*base 19 Kristiansand, node_van, M322/A110*/, 1120, 120, 150 /*≈2h30 Fjord Line*/, 2, true),
  ('ferry_retour',      'ferry',       'Ferry Fjord Line Kristiansand → Hirtshals', '2027-08-25 09:00:00+02', 22, 'Kristiansand',                       1168891 /*base 19 Kristiansand, node_van, M322/A110*/, 540,  60,  150,                     3, true),
  ('transit_all_retour','transit',     'Transit Allemagne (retour)',                NULL,                     23, 'Hirtshals → Schweighouse-sur-Moder',  NULL, NULL, 780 /*≈1j*/, NULL,        4, true),
  ('restitution',       'restitution', 'Restitution du van',                        '2027-08-26 00:00:00+02', 24, 'Schweighouse-sur-Moder',              NULL, NULL, 0,          NULL,        5, false);

COMMIT;

-- ============================================================================
-- G2 (budgets fige) : au flip, le producteur de fige remplit fige.etape.roulage_min pour les jours d'ancre + étapes
-- obligatoires depuis voyage.ancre.budget_roulage_min (les autres jours au recompute).
-- À VALIDER (M/A) : (1) table voyage.ancre vs fige.waypoint_impose [VALIDÉ voyage.ancre, M305] ;
--   (2) noeud graphe quai Kristiansand [RÉSOLU : base 19 / node_van 1168891, M322/A110] ;
--   (3) budgets roulage réels transit Allemagne [EN ATTENTE mesure d'A — forfait canonique, R1] ; (4) index jours 1..24.
-- Rollback : DROP TABLE voyage.ancre.
-- ============================================================================
