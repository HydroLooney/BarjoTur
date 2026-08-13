// Test de exigerPresent : garde pure du passage « cible absente → erreur HTTP », réutilisée par les services.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exigerPresent, Erreurs, ErreurRequete } from './erreurs.js';

test('exigerPresent rend la valeur quand elle est présente (y compris falsy non nul)', () => {
  assert.equal(exigerPresent(42, Erreurs.codeInconnu), 42);
  assert.equal(exigerPresent(0, Erreurs.codeInconnu), 0);
  assert.equal(exigerPresent('', Erreurs.codeInconnu), '');
  assert.deepEqual(exigerPresent({ a: 1 }, Erreurs.codeInconnu), { a: 1 });
});

test('exigerPresent lève l\'erreur fournie sur null ou undefined', () => {
  assert.throws(() => exigerPresent(null, Erreurs.codeInconnu), ErreurRequete);
  assert.throws(() => exigerPresent(undefined, Erreurs.figeIntrouvable), (e: unknown) => {
    return e instanceof ErreurRequete && e.code === 'fige_introuvable' && e.statut === 404;
  });
});
