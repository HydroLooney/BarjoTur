// Budget-temps d'un jour (A21, M089) — surface PURE côté composeur (B). Le composeur ne compte plus seulement le
// TRAJET, mais aussi le TEMPS SUR PLACE de chaque visite, plus un bloc de FLÂNERIE du jour (distinct, jamais dilué
// dans les durées d'activité, A21). On agrège, on mesure la marge sous le plafond-jour (rythme réglable : journée
// pleine vs jour doux), et on choisit le palier d'une activité « en bloc » (kayak) selon ce qui reste dans le jour.
//
// Les durées de visite (BudgetTempsVisite.duree_retenue_min) sont CALCULÉES par A (clamp × avis × appétit → arrondi
// PAS_MIN → palier) et ajustables par C. Ici on ne (re)calcule pas une durée : on remplit le jour avec des durées
// déjà résolues. Le contrat vit dans @barjotur/shared/activite.ts (posé par M).

/** Un arrêt du jour, du point de vue du budget-temps : le trajet pour l'atteindre + la durée de visite retenue. */
export interface ArretJour {
  trajet_min: number;
  duree_retenue_min: number;
}

/** Budget-temps agrégé d'un jour : total et sa ventilation (trajet / visites / flânerie). */
export interface BudgetJour {
  total_min: number;
  trajet_min: number;
  visite_min: number;
  flanerie_min: number;
}

/** Agrège le budget-temps d'un jour : Σ(trajet + durée de visite) + le bloc de flânerie. Pure. */
export function budgetJour(arrets: readonly ArretJour[], flanerie_min: number): BudgetJour {
  const trajet_min = arrets.reduce((s, a) => s + a.trajet_min, 0);
  const visite_min = arrets.reduce((s, a) => s + a.duree_retenue_min, 0);
  return { total_min: trajet_min + visite_min + flanerie_min, trajet_min, visite_min, flanerie_min };
}

/** Marge du jour sous le plafond (négative si le jour déborde). Le plafond porte le rythme réglable (A21). Pure. */
export function margeJour(budget: BudgetJour, plafond_min: number): number {
  return plafond_min - budget.total_min;
}

/** Le jour tient-il sous son plafond ? Pure. */
export function tientDansLeJour(budget: BudgetJour, plafond_min: number): boolean {
  return margeJour(budget, plafond_min) >= 0;
}

/**
 * Choisit le palier d'une activité « en bloc » (granularité ≠ libre) : le PLUS GRAND palier offert qui rentre dans le
 * temps restant du jour (kayak journée si ça rentre, sinon demi-journée). Rien SOUS le plus petit palier (« en dessous
 * compliqué », A21) : si même le plus petit ne rentre pas, l'activité ne se place pas ce jour → `null`. Pure.
 */
export function choisirPalier(granularites: readonly number[], budgetRestant_min: number): number | null {
  const tries = [...granularites].sort((a, b) => a - b);
  let choisi: number | null = null;
  for (const palier of tries) {
    if (palier <= budgetRestant_min) choisi = palier;
  }
  return choisi;
}
