// TDD (M004) : ce test précède l'implémentation de fige.ts. On teste la logique pure d'analyse de l'id figé,
// sans DB. L'orchestration RPC et le mapping d'erreurs relèvent de la recette d'API (playwright / DB2 live).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFigeId } from './fige.js';
import { ErreurRequete } from '../http/erreurs.js';

test('parseFigeId accepte un entier positif', () => {
  assert.equal(parseFigeId('134'), 134);
  assert.equal(parseFigeId('1'), 1);
});

test('parseFigeId refuse zéro et négatif (fige_id > 0)', () => {
  assert.throws(() => parseFigeId('0'), ErreurRequete);
  assert.throws(() => parseFigeId('-3'), ErreurRequete);
});

test('parseFigeId refuse le non-entier et le vide', () => {
  assert.throws(() => parseFigeId('abc'), ErreurRequete);
  assert.throws(() => parseFigeId('1.5'), ErreurRequete);
  assert.throws(() => parseFigeId(''), ErreurRequete);
});
