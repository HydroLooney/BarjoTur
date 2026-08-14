// TDD (M004) : validations pures de la mémoire perso (exploration + collections), avant tout appel DB.
// Exploration : osm_id non vide + statut dans {vu, explore}. Collection : contenu = objet ou tableau JSON.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validerMarque, validerContenu, estStatutValide } from './memoire.js';
import { ErreurRequete } from '../http/erreurs.js';

test('estStatutValide ne reconnaît que vu et explore', () => {
  assert.equal(estStatutValide('vu'), true);
  assert.equal(estStatutValide('explore'), true);
  assert.equal(estStatutValide('exploré'), false);
  assert.equal(estStatutValide(''), false);
  assert.equal(estStatutValide(2), false);
});

test('validerMarque accepte une marque valide', () => {
  assert.deepEqual(validerMarque({ osm_id: 'w123456', statut: 'explore' }), {
    osm_id: 'w123456',
    statut: 'explore',
  });
});

test('validerMarque refuse osm_id manquant ou vide', () => {
  assert.throws(() => validerMarque({ statut: 'vu' }), ErreurRequete);
  assert.throws(() => validerMarque({ osm_id: '   ', statut: 'vu' }), ErreurRequete);
});

test('validerMarque refuse un statut hors liste', () => {
  assert.throws(() => validerMarque({ osm_id: 'n1', statut: 'adoré' }), ErreurRequete);
  assert.throws(() => validerMarque({ osm_id: 'n1' }), ErreurRequete);
});

test('validerMarque refuse un corps non objet', () => {
  assert.throws(() => validerMarque(null), ErreurRequete);
  assert.throws(() => validerMarque([1, 2]), ErreurRequete);
  assert.throws(() => validerMarque('vu'), ErreurRequete);
});

test('validerContenu accepte objet et tableau', () => {
  assert.deepEqual(validerContenu({ repas: [] }), { repas: [] });
  assert.deepEqual(validerContenu([1, 2, 3]), [1, 2, 3]);
});

test('validerContenu refuse null et les scalaires', () => {
  assert.throws(() => validerContenu(null), ErreurRequete);
  assert.throws(() => validerContenu('texte'), ErreurRequete);
  assert.throws(() => validerContenu(42), ErreurRequete);
});
