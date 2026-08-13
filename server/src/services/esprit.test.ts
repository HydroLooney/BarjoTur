// TDD (M004) : validation pure de l'esprit de voyage (api.set_esprit) avant tout appel DB.
// choix/poids/cibles sont des cartes axe→nombre, chacune optionnelle. On tolère l'absence (→ null),
// on refuse un type manifestement faux (tableau, primitive) ou une valeur non numérique.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validerEsprit } from './esprit.js';
import { ErreurRequete } from '../http/erreurs.js';

test('validerEsprit accepte des cartes axe→nombre', () => {
  const v = validerEsprit({ choix: { nature: 2.3, effort: 4.7 }, poids: { nature: 1 }, cibles: {} });
  assert.deepEqual(v.choix, { nature: 2.3, effort: 4.7 });
  assert.deepEqual(v.poids, { nature: 1 });
  assert.deepEqual(v.cibles, {});
});

test('validerEsprit met à null les sections absentes', () => {
  const v = validerEsprit({ choix: { nature: 2 } });
  assert.deepEqual(v.choix, { nature: 2 });
  assert.equal(v.poids, null);
  assert.equal(v.cibles, null);
});

test('validerEsprit refuse un corps non-objet', () => {
  assert.throws(() => validerEsprit(null), ErreurRequete);
  assert.throws(() => validerEsprit([1, 2]), ErreurRequete);
});

test('validerEsprit refuse une section de mauvais type ou valeur non numérique', () => {
  assert.throws(() => validerEsprit({ choix: [1, 2] }), ErreurRequete);
  assert.throws(() => validerEsprit({ choix: 'nature' }), ErreurRequete);
  assert.throws(() => validerEsprit({ choix: { nature: 'beaucoup' } }), ErreurRequete);
  assert.throws(() => validerEsprit({ poids: { nature: Infinity } }), ErreurRequete);
});
