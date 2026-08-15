// TDD (M355) : la marge EFFECTIVE se dérive des deux totaux réels du comparatif (prudent vs non-prudent), au lieu du
// const shared MARGE_SECURITE_PCT=20 désynchronisé des vraies marges par poste (budget.parametre). + assertion EUR-only.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { margeEffectivePct, budgetEurCoherent } from './budget-marge.js';
import type { BudgetComparatif } from '@barjotur/shared';

function comparatif(prudent: number, nonPrudent: number, postes?: Partial<BudgetComparatif['postes']>): BudgetComparatif {
  return {
    fige_id: 1, code: null, label: null, source: 'test', archetype_key: null, prenom: null, km: 0, nuits: 0,
    postes: { van: 0, activites: 0, carburant: 0, hebergement: 0, repas_courses: 0, ferry_interieur: 0, ferry_international: 0, ...postes },
    par_adulte: { note: '', nb_adultes: 2, prudent_eur: prudent / 2, non_prudent_eur: nonPrudent / 2 },
    alertes: { hard_cap_eur: 0, soft_cap_eur: 0, depasse_hard_prudent: false, depasse_soft_prudent: false, depasse_hard_non_prudent: false, depasse_soft_non_prudent: false },
    total_prudent_eur: prudent, total_non_prudent_eur: nonPrudent,
  };
}

test('margeEffectivePct dérive la marge réellement appliquée des deux totaux', () => {
  assert.equal(margeEffectivePct(comparatif(120, 100)), 20); // +20 %
  assert.equal(margeEffectivePct(comparatif(109, 100)), 9);  // le 9 % historique, retrouvé sans const en dur
});

test('margeEffectivePct : non-prudent nul → 0 (pas de division par zéro)', () => {
  assert.equal(margeEffectivePct(comparatif(0, 0)), 0);
});

test('budgetEurCoherent : montants finis → true ; NaN/Infinity → false', () => {
  assert.equal(budgetEurCoherent(comparatif(120, 100)), true);
  assert.equal(budgetEurCoherent(comparatif(Number.NaN, 100)), false);
  assert.equal(budgetEurCoherent(comparatif(120, 100, { carburant: Number.POSITIVE_INFINITY })), false);
});
