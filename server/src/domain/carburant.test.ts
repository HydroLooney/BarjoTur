// TDD (T045, M090) : coût carburant recomposé À LA VOLÉE depuis le km (fixe, matrice) et les params réglables. Le
// slider (surconso %, prix diesel) NE recalcule PAS la matrice ; seul le € se recompose. Pur, single-source, sans DB.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONSO_BASE_L_100, PRIX_DIESEL_BASE, consoEffectiveL100, coutCarburantEur } from './carburant.js';

/** Le calcul est exact au sens mathématique ; on compare à ε près (le binaire flottant, ex. 9,5×1,2 = 11,3999…). */
const proche = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);

test('les constantes du van retenu (Guillaume 14/08) : conso base 9,5 L/100 fixe, prix diesel base 2,00 €/L', () => {
  assert.equal(CONSO_BASE_L_100, 9.5);
  assert.equal(PRIX_DIESEL_BASE, 2.0);
});

test('consoEffectiveL100 applique la surconsommation en % de plus sur la conso base fixe', () => {
  assert.equal(consoEffectiveL100(0), 9.5); // pas de surconso
  proche(consoEffectiveL100(20), 11.4); // 9,5 × 1,20
});

test('coutCarburantEur = (conso_effective/100) × prix_diesel × km', () => {
  proche(coutCarburantEur(100, 0, 2.0), 19.0); // 9,5/100 × 2,00 × 100
  proche(coutCarburantEur(100, 20, 2.0), 22.8); // 11,4/100 × 2,00 × 100
  proche(coutCarburantEur(250, 0, 1.5), 35.625); // 9,5/100 × 1,50 × 250
  assert.equal(coutCarburantEur(0, 50, 2.8), 0); // 0 km → 0 €
});
