// Contrats budget (passe-plat de api.budget_comparatif / api.budget_variante, shapes B023).
// Deux lectures du budget d'un ou plusieurs figés : prudente (marges hautes) et non prudente.

export interface BudgetPostes {
  van: number;
  activites: number;
  carburant: number;
  hebergement: number;
  repas_courses: number;
  ferry_interieur: number;
  ferry_international: number;
  /** Péages (NVDB bomstasjon, van chargé). Nouvelle dimension € du routage van (A035/A037). Additif : présent dès que projeté (006). */
  peages?: number;
  /** Étapes de transit (A/R et transits insérés) : carburant + péages + ferry + nuits, autonomie par défaut (A19 §8.4). Additif : présent dès que projeté (006). */
  transit?: number;
}

/**
 * Marge de sécurité par défaut, en % — REPLI SEULEMENT (B109). La vérité, ce sont les marges PAR POSTE de
 * `budget.parametre` (carburant/camping/confort/activités/ferry/péages/imprévus/inflation/courses), appliquées en DB2.
 * Ne PAS s'en servir pour afficher la marge d'un budget réel : utiliser `margeEffectivePct` (marge effective mesurée).
 * Cette constante ne vaut que comme défaut de secours quand aucun comparatif n'est disponible.
 */
export const MARGE_SECURITE_PCT = 20;

/**
 * Applique une marge de sécurité en % à un montant. Source unique : B (autorité budget) et C (curseur) l'appellent
 * pour la lecture prudente, comme `coutCarburantEur`. Pur.
 */
export function appliquerMarge(montant: number, marge_pct: number): number {
  return montant * (1 + marge_pct / 100);
}

export interface BudgetParAdulte {
  note: string;
  nb_adultes: number;
  prudent_eur: number;
  non_prudent_eur: number;
}

export interface BudgetAlertes {
  hard_cap_eur: number;
  soft_cap_eur: number;
  depasse_hard_prudent: boolean;
  depasse_soft_prudent: boolean;
  depasse_hard_non_prudent: boolean;
  depasse_soft_non_prudent: boolean;
}

/** Budget comparatif d'un figé (une ligne par profil comparé). `budget_variante(fige_id)` rend la même forme. */
export interface BudgetComparatif {
  fige_id: number | null;
  code: string | null;
  label: string | null;
  source: string;
  archetype_key: string | null;
  prenom: string | null;
  km: number;
  nuits: number;
  postes: BudgetPostes;
  par_adulte: BudgetParAdulte;
  alertes: BudgetAlertes;
  total_prudent_eur: number;
  total_non_prudent_eur: number;
}

/**
 * Marge EFFECTIVE d'un comparatif, en % : (prudent − non_prudent) / non_prudent × 100. Source de vérité pour le
 * curseur et l'affichage (B109) — reflète les vraies marges par poste appliquées en DB2, PAS la constante
 * `MARGE_SECURITE_PCT`. Rend 0 si `non_prudent` ≤ 0 (évite la division par zéro). Pur.
 */
export function margeEffectivePct(c: Pick<BudgetComparatif, 'total_prudent_eur' | 'total_non_prudent_eur'>): number {
  if (c.total_non_prudent_eur <= 0) return 0;
  return ((c.total_prudent_eur - c.total_non_prudent_eur) / c.total_non_prudent_eur) * 100;
}

/**
 * Garde de cohérence du budget en EUR (B109) : tous les totaux/postes sont des nombres finis et EUR-only (aucun montant
 * NOK non converti ne doit fuiter dans un total). Rend false au moindre montant non fini. Pur.
 */
export function budgetEurCoherent(c: BudgetComparatif): boolean {
  const montants = [
    c.total_prudent_eur,
    c.total_non_prudent_eur,
    ...Object.values(c.postes),
  ].filter((v): v is number => v !== undefined);
  return montants.every((v) => Number.isFinite(v));
}
