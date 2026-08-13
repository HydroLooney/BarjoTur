// Tests des validateurs de vote (logique pure, sans DB). Couvre la grammaire tier-list réelle (T/S/A/B/C/D)
// et la forme des références (p:/c:/v:). L'orchestration RPC et le mapping d'erreurs relèvent de la recette d'API.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estTierValide, validerRef, validerTiers } from './votes.js';
import { ErreurRequete } from '../http/erreurs.js';

test('estTierValide accepte les six tiers réels et rejette le reste', () => {
  for (const t of ['T', 'S', 'A', 'B', 'C', 'D']) {
    assert.equal(estTierValide(t), true, `tier ${t}`);
  }
  assert.equal(estTierValide('E'), false);
  assert.equal(estTierValide(''), false);
  assert.equal(estTierValide(1), false);
});

test('validerRef accepte p:/c:/v: et rejette les formes invalides', () => {
  assert.equal(validerRef('p:-123'), 'p:-123'); // osm_id peut être négatif
  assert.equal(validerRef('c:45'), 'c:45');
  assert.equal(validerRef('v:oslo-lofoten'), 'v:oslo-lofoten');
  assert.throws(() => validerRef('x:1'), ErreurRequete);
  assert.throws(() => validerRef('p:'), ErreurRequete);
  assert.throws(() => validerRef('123'), ErreurRequete);
  assert.throws(() => validerRef(42), ErreurRequete);
});

test('validerTiers accepte une carte propre, rejette clé ou tier invalide', () => {
  assert.deepEqual(validerTiers({ 'p:1': 'S', 'c:2': 'A' }), { 'p:1': 'S', 'c:2': 'A' });
  assert.deepEqual(validerTiers({}), {});
  assert.throws(() => validerTiers({ mauvaise: 'S' }), ErreurRequete);
  assert.throws(() => validerTiers({ 'p:1': 'Z' }), ErreurRequete);
  assert.throws(() => validerTiers(['p:1']), ErreurRequete);
  assert.throws(() => validerTiers(null), ErreurRequete);
});
