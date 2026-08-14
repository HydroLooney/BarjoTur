// TDD (T?/M089, A21) : budget-temps d'un jour côté composeur. PUR, sans DB. On agrège trajet + durée de visite + un
// bloc de flânerie (jamais dilué dans les visites), on mesure la marge sous le plafond-jour (rythme réglable), et on
// choisit le palier d'une activité en bloc (kayak journée vs demi-journée) selon ce qui reste dans le jour.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { budgetJour, margeJour, tientDansLeJour, choisirPalier } from './budget-temps.js';
import { JOURNEE_MIN, DEMI_JOURNEE_MIN } from '@barjotur/shared';

test('budgetJour somme trajet + durée de visite par arrêt, plus le bloc flânerie du jour', () => {
  const b = budgetJour([{ trajet_min: 30, duree_retenue_min: 90 }, { trajet_min: 20, duree_retenue_min: 60 }], 45);
  assert.deepEqual(b, { total_min: 245, trajet_min: 50, visite_min: 150, flanerie_min: 45 });
});

test('budgetJour sans arrêt = la seule flânerie', () => {
  assert.deepEqual(budgetJour([], 30), { total_min: 30, trajet_min: 0, visite_min: 0, flanerie_min: 30 });
});

test('margeJour = plafond - total (négatif si le jour déborde) ; tientDansLeJour en découle', () => {
  const b = budgetJour([{ trajet_min: 60, duree_retenue_min: 300 }], 30); // total 390
  assert.equal(margeJour(b, JOURNEE_MIN), 90); // 480 - 390
  assert.equal(tientDansLeJour(b, JOURNEE_MIN), true);
  assert.equal(margeJour(b, DEMI_JOURNEE_MIN), -150); // 240 - 390
  assert.equal(tientDansLeJour(b, DEMI_JOURNEE_MIN), false);
});

test('choisirPalier prend le PLUS GRAND palier qui rentre, jamais sous le plus petit', () => {
  assert.equal(choisirPalier([DEMI_JOURNEE_MIN, JOURNEE_MIN], 500), JOURNEE_MIN); // journée rentre
  assert.equal(choisirPalier([DEMI_JOURNEE_MIN, JOURNEE_MIN], 300), DEMI_JOURNEE_MIN); // que la demi
  assert.equal(choisirPalier([DEMI_JOURNEE_MIN, JOURNEE_MIN], 240), DEMI_JOURNEE_MIN); // pile la demi
  assert.equal(choisirPalier([DEMI_JOURNEE_MIN, JOURNEE_MIN], 200), null); // sous le plus petit → ne rentre pas
  assert.equal(choisirPalier([JOURNEE_MIN, DEMI_JOURNEE_MIN], 300), DEMI_JOURNEE_MIN); // entrée non triée
  assert.equal(choisirPalier([], 999), null); // pas de palier offert
});
