// TDD (M052) : normalisation du rôle physique DB2 vers le vocabulaire d'accès du contrat. whoami = source unique.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normaliserRole } from './identite.js';

test('normaliserRole mappe le physique DB2 vers le contrat', () => {
  assert.equal(normaliserRole('owner'), 'organisateur_principal');
  assert.equal(normaliserRole('mamie'), 'voyageur');
  assert.equal(normaliserRole('enfant'), 'voyageur');
  assert.equal(normaliserRole('demo'), 'demo');
});

test('normaliserRole est idempotent sur le vocabulaire contrat', () => {
  assert.equal(normaliserRole('organisateur_principal'), 'organisateur_principal');
  assert.equal(normaliserRole('organisateur'), 'organisateur');
  assert.equal(normaliserRole('voyageur'), 'voyageur');
  assert.equal(normaliserRole('invite'), 'invite');
});

test('normaliserRole : rôle inconnu retombe sur voyageur, JAMAIS organisateur (défaut prudent)', () => {
  assert.equal(normaliserRole('n_importe_quoi'), 'voyageur');
  assert.equal(normaliserRole(''), 'voyageur');
});
