// TDD (A048/M089) : passe-plat budget-temps d'un POI. Le seul morceau à logique testable sans DB est la validation de
// l'identifiant de POI d'URL ; la lecture (api.budget_temps_poi) est un passe-plat flip-ready (gaté DSN + producteur A).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePoiId } from './activite.js';
import { ErreurRequete } from '../http/erreurs.js';

test('parsePoiId accepte un entier positif, refuse le reste (400)', () => {
  assert.equal(parsePoiId('141'), 141);
  assert.throws(() => parsePoiId('0'), ErreurRequete);
  assert.throws(() => parsePoiId('-3'), ErreurRequete);
  assert.throws(() => parsePoiId('abc'), ErreurRequete);
  assert.throws(() => parsePoiId('1.5'), ErreurRequete);
});
