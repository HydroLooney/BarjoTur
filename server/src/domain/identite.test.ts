// TDD (M052) : normalisation du rôle physique DB2 vers le vocabulaire d'accès du contrat. whoami = source unique.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normaliserRole, qualifierDepuisRole } from './identite.js';

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

test('qualifierDepuisRole dérive la qualification du rôle PHYSIQUE (le lien famille porte l’âge, M052/M082)', () => {
  // La tribu réelle : enfant→enfant, mamie/owner→adulte, demo→null (ni voyageur qualifié).
  assert.equal(qualifierDepuisRole('enfant'), 'enfant');
  assert.equal(qualifierDepuisRole('mamie'), 'adulte');
  assert.equal(qualifierDepuisRole('owner'), 'adulte');
  assert.equal(qualifierDepuisRole('organisateur'), 'adulte');
  assert.equal(qualifierDepuisRole('voyageur'), 'adulte');
  assert.equal(qualifierDepuisRole('demo'), null);
  assert.equal(qualifierDepuisRole('invite'), null);
  assert.equal(qualifierDepuisRole('inconnu'), null);
});
