// Marge budget EFFECTIVE + cohérence devise (M355, QA-BUDGET-v3.md). PUR. Le calcul du budget vit dans le RPC DB2
// (api.budget_comparatif) avec les marges PAR POSTE (budget.parametre) ; ici on dérive la marge réellement appliquée des
// deux totaux rendus, pour que le curseur (C) utilise la VRAIE marge et non le const shared MARGE_SECURITE_PCT (=20),
// désynchronisé des marges par poste. À hisser en @barjotur/shared par M (comme arbitrage/carburant).

import type { BudgetComparatif } from '@barjotur/shared';

/** Marge de sécurité RÉELLEMENT appliquée par le RPC, en % : (prudent − non_prudent) / non_prudent × 100. 0 si le
 *  non-prudent est nul (pas de division par zéro). Pur. Retrouve les repères historiques (9 %, 20 %) sans const en dur. */
export function margeEffectivePct(c: BudgetComparatif): number {
  const base = c.total_non_prudent_eur;
  if (!Number.isFinite(base) || base === 0) return 0;
  return ((c.total_prudent_eur - base) / base) * 100;
}

/** Cohérence EUR : tous les montants (postes + totaux + par_adulte) sont finis (aucun NaN/Infinity). Le contrat n'expose
 *  que des `*_eur` (conversion NOK→EUR faite en DB2 au taux `taux_eur_nok`) : aucun mélange de devise possible côté BFF.
 *  Rend faux si un montant est non fini (donnée manquante mal convertie). Pur. */
export function budgetEurCoherent(c: BudgetComparatif): boolean {
  const montants = [
    c.total_prudent_eur,
    c.total_non_prudent_eur,
    c.par_adulte.prudent_eur,
    c.par_adulte.non_prudent_eur,
    ...Object.values(c.postes),
  ];
  return montants.every((m) => typeof m === 'number' && Number.isFinite(m));
}
