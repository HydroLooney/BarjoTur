// TDD (M004) : tests de la logique pure de validation du composeur, sans sidecar ni DB.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validerComposeInput } from './composeur.js';
import { ErreurRequete } from '../http/erreurs.js';

test('validerComposeInput accepte un corps minimal valide', () => {
  const input = validerComposeInput({ bases: [1, 2, 3] });
  assert.deepEqual(input.bases, [1, 2, 3]);
  assert.equal(input.archetype_key, null);
  assert.equal(input.avec_agenda, true);
  assert.equal(input.persister, false);
});

test('validerComposeInput accepte archetype_key et options', () => {
  const input = validerComposeInput({
    bases: [10, 20],
    archetype_key: 'slow_nature',
    avec_agenda: false,
    persister: true,
  });
  assert.equal(input.archetype_key, 'slow_nature');
  assert.equal(input.avec_agenda, false);
  assert.equal(input.persister, true);
});

test('validerComposeInput accepte archetype_key null explicite', () => {
  const input = validerComposeInput({ bases: [1], archetype_key: null });
  assert.equal(input.archetype_key, null);
});

test('validerComposeInput rejette un corps non-objet', () => {
  assert.throws(() => validerComposeInput('bases'), ErreurRequete);
  assert.throws(() => validerComposeInput(null), ErreurRequete);
  assert.throws(() => validerComposeInput([1, 2]), ErreurRequete);
});

test('validerComposeInput rejette bases vide', () => {
  assert.throws(() => validerComposeInput({ bases: [] }), ErreurRequete);
});

test('validerComposeInput rejette bases absent', () => {
  assert.throws(() => validerComposeInput({}), ErreurRequete);
});

test('validerComposeInput rejette base_id non entier', () => {
  assert.throws(() => validerComposeInput({ bases: [1.5, 2] }), ErreurRequete);
  assert.throws(() => validerComposeInput({ bases: ['abc'] }), ErreurRequete);
  assert.throws(() => validerComposeInput({ bases: [0] }), ErreurRequete);
  assert.throws(() => validerComposeInput({ bases: [-1] }), ErreurRequete);
});

test('validerComposeInput rejette archetype_key non-string', () => {
  assert.throws(() => validerComposeInput({ bases: [1], archetype_key: 42 }), ErreurRequete);
});
