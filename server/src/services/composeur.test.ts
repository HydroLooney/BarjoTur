// TDD (M004) : tests de la logique pure de validation du composeur, sans sidecar ni DB.
// M469 : bases absentes/vides ⇒ mode AUTO (auto-compose parité v2), plus une erreur.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validerComposeInput, resoudreBases } from './composeur.js';
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

test('validerComposeInput accepte bases vide (mode auto, M469)', () => {
  const input = validerComposeInput({ bases: [] });
  assert.deepEqual(input.bases, []);
});

test('validerComposeInput accepte bases absent (mode auto, M469)', () => {
  const input = validerComposeInput({});
  assert.deepEqual(input.bases, []);
});

test('validerComposeInput accepte un corps entièrement vide (mode auto)', () => {
  const input = validerComposeInput({ archetype_key: 'slow_nature' });
  assert.deepEqual(input.bases, []);
  assert.equal(input.archetype_key, 'slow_nature');
});

test('validerComposeInput rejette bases fourni non-tableau', () => {
  assert.throws(() => validerComposeInput({ bases: 'abc' }), ErreurRequete);
  assert.throws(() => validerComposeInput({ bases: 42 }), ErreurRequete);
});

test('validerComposeInput rejette base_id non entier quand bases fourni', () => {
  assert.throws(() => validerComposeInput({ bases: [1.5, 2] }), ErreurRequete);
  assert.throws(() => validerComposeInput({ bases: ['abc'] }), ErreurRequete);
  assert.throws(() => validerComposeInput({ bases: [0] }), ErreurRequete);
  assert.throws(() => validerComposeInput({ bases: [-1] }), ErreurRequete);
});

test('validerComposeInput rejette archetype_key non-string', () => {
  assert.throws(() => validerComposeInput({ bases: [1], archetype_key: 42 }), ErreurRequete);
});

// --- resoudreBases : cœur de l'auto-compose (M469) ---

test('resoudreBases respecte des bases fournies sans toucher au vivier', async () => {
  let vivierAppele = false;
  const bases = await resoudreBases([1, 2, 3], async () => {
    vivierAppele = true;
    return [9, 9, 9];
  });
  assert.deepEqual(bases, [1, 2, 3]);
  assert.equal(vivierAppele, false, 'le vivier ne doit pas être lu en mode manuel');
});

test('resoudreBases auto-remplit depuis le vivier quand bases vide', async () => {
  const bases = await resoudreBases([], async () => [1, 2, 3, 104, 105]);
  assert.deepEqual(bases, [1, 2, 3, 104, 105]);
});

test('resoudreBases rejette si le vivier est vide (rien à composer)', async () => {
  await assert.rejects(() => resoudreBases([], async () => []), ErreurRequete);
});
