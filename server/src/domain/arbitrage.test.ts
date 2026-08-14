// TDD (M073) : arbitrage bi-critère temps↔argent d'une liaison (base→base) entre ses variantes de route.
// Pur, sans DB ni sidecar. La matrice bi-critère (temps + €, variantes ferry/péage) est produite par A (corridor) ;
// ici on ne teste QUE la sélection : dominer le front de Pareto, puis choisir selon la valeur du temps de l'utilisateur.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  coutTotalEur,
  frontPareto,
  choisirVariante,
  type VarianteLiaison,
} from './arbitrage.js';

function v(
  mode: VarianteLiaison['mode'],
  temps_min: number,
  carburant = 0,
  ferry = 0,
  peage = 0,
  km = 0,
): VarianteLiaison {
  return { mode, temps_min, km, cout: { carburant_eur: carburant, ferry_eur: ferry, peage_eur: peage } };
}

test('coutTotalEur additionne carburant + ferry + péage', () => {
  assert.equal(coutTotalEur(v('defaut', 60, 12, 30, 8)), 50);
  assert.equal(coutTotalEur(v('sans_peage', 130, 20, 0, 0)), 20);
});

test('frontPareto écarte une variante strictement dominée (plus lente ET plus chère)', () => {
  const rapide_chere = v('defaut', 60, 10, 30, 0); // 60 min, 40 €
  const dominee = v('sans_ferry', 130, 20, 0, 12); // 130 min, 32 €... incomparable, garder
  const nulle = v('sans_peage', 200, 60, 0, 0); // 200 min, 60 € : plus lente ET plus chère que les deux → dominée
  const front = frontPareto([rapide_chere, dominee, nulle]);
  assert.deepEqual(
    front.map((x) => x.mode),
    ['defaut', 'sans_ferry'],
  );
});

test('frontPareto garde deux variantes incomparables (une plus rapide-chère, une plus lente-gratuite)', () => {
  const ferry = v('defaut', 60, 10, 30, 0); // 60 min, 40 €
  const route = v('sans_ferry', 130, 20, 0, 0); // 130 min, 20 €
  const front = frontPareto([ferry, route]);
  assert.equal(front.length, 2);
});

test('choisirVariante à valeur du temps nulle prend la moins chère', () => {
  const ferry = v('defaut', 60, 10, 30, 0); // 40 €
  const route = v('sans_ferry', 130, 20, 0, 0); // 20 €
  assert.equal(choisirVariante([ferry, route], 0).mode, 'sans_ferry');
});

test('choisirVariante à valeur du temps élevée prend la plus rapide', () => {
  const ferry = v('defaut', 60, 10, 30, 0); // 60 min
  const route = v('sans_ferry', 130, 20, 0, 0); // 130 min
  assert.equal(choisirVariante([ferry, route], 200).mode, 'defaut');
});

test('choisirVariante arbitre au point de bascule (valeur du temps intermédiaire)', () => {
  const ferry = v('defaut', 60, 0, 30, 0); // 60 min, 30 €
  const route = v('sans_ferry', 130, 0, 0, 0); // 130 min, 0 €
  // À 15 €/h : ferry = 30 + 15*1 = 45 ; route = 0 + 15*(130/60) = 32,5 → route.
  assert.equal(choisirVariante([ferry, route], 15).mode, 'sans_ferry');
  // À 30 €/h : ferry = 30 + 30 = 60 ; route = 0 + 30*2,166 = 65 → ferry.
  assert.equal(choisirVariante([ferry, route], 30).mode, 'defaut');
});

test('choisirVariante refuse une liste vide (précondition : au moins une variante)', () => {
  assert.throws(() => choisirVariante([], 15), /variante/i);
});
