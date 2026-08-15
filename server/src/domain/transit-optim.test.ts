// TDD (M315 item 3, G3) : optimisation PURE des legs de transit (repositionnement A→B), minimisée, honorant les arrêts
// IMPOSÉS (réservations) comme jalons obligatoires. Le modèle de coût réel (temps/€ par leg) vient du corridor d'A
// (variante_transit, gaté) ; ici il est INJECTÉ (synthétique). L'exécution réelle attend A ; le câblage + les tests se
// posent maintenant. Pur, sans DB ni sidecar.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { optimiserSequenceTransit } from './transit-optim.js';

// Modèle de coût synthétique : dictionnaire de legs ; leg manquant = +Infinity (non routable).
function coutDe(legs: Record<string, number>) {
  return (de: string, vers: string): number => legs[`${de}->${vers}`] ?? Number.POSITIVE_INFINITY;
}

test('sans arrêt imposé : leg direct depart→arrivee', () => {
  const r = optimiserSequenceTransit('A', 'B', [], coutDe({ 'A->B': 10 }));
  assert.deepEqual(r.arrets, ['A', 'B']);
  assert.equal(r.cout_total, 10);
  assert.equal(r.faisable, true);
});

test('un arrêt imposé : depart→imposé→arrivee', () => {
  const r = optimiserSequenceTransit('A', 'B', ['R'], coutDe({ 'A->R': 4, 'R->B': 5 }));
  assert.deepEqual(r.arrets, ['A', 'R', 'B']);
  assert.equal(r.cout_total, 9);
});

test('deux arrêts imposés : choisit l’ordre le moins coûteux', () => {
  // A→X→Y→B = 1+9+1 = 11 ; A→Y→X→B = 1+2+1 = 4 → l’optimiseur prend Y avant X.
  const legs = { 'A->X': 1, 'A->Y': 1, 'X->Y': 9, 'Y->X': 2, 'X->B': 1, 'Y->B': 1 };
  const r = optimiserSequenceTransit('A', 'B', ['X', 'Y'], coutDe(legs));
  assert.deepEqual(r.arrets, ['A', 'Y', 'X', 'B']);
  assert.equal(r.cout_total, 4);
});

test('leg manquant sur toutes les permutations : infaisable (faisable=false)', () => {
  const r = optimiserSequenceTransit('A', 'B', ['R'], coutDe({ 'A->R': 4 })); // pas de R->B
  assert.equal(r.faisable, false);
  assert.equal(r.cout_total, Number.POSITIVE_INFINITY);
});

test('une permutation infaisable, l’autre OK : retient la faisable', () => {
  // A→X→Y→B faisable (6) ; A→Y→X→B a un trou (Y->X manquant) → seule la 1re compte.
  const legs = { 'A->X': 1, 'X->Y': 4, 'Y->B': 1, 'A->Y': 1, 'X->B': 1 };
  const r = optimiserSequenceTransit('A', 'B', ['X', 'Y'], coutDe(legs));
  assert.equal(r.faisable, true);
  assert.deepEqual(r.arrets, ['A', 'X', 'Y', 'B']);
  assert.equal(r.cout_total, 6);
});
