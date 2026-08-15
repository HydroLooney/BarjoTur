// TDD (M240) : sélection bi-critère d'une variante de liaison AVEC préférences éviter-ferry / éviter-péage,
// posées PAR-DESSUS le curseur temps↔argent existant (choisirVariante). Pur, sans DB ni sidecar. A produit les
// variantes (routage) ; ce module ne fait que la sélection sous préférences. « éviter ferry/péage » se lit sur le
// coût (ferry_eur>0 / peage_eur>0) comme proxy honnête (R1) — une variante `sans_ferry` a ferry_eur=0 par construction,
// mais une `defaut` sans traversée disponible aussi ; on juge donc sur le fait (coût), pas sur l'étiquette de mode.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  utiliseFerry,
  utilisePeage,
  selectionnerVariante,
  type VarianteLiaison,
} from './variantes.js';

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

test('utiliseFerry / utilisePeage lisent le fait sur le coût (proxy R1)', () => {
  assert.equal(utiliseFerry(v('defaut', 60, 10, 30, 0)), true);
  assert.equal(utiliseFerry(v('sans_ferry', 130, 20, 0, 0)), false);
  assert.equal(utilisePeage(v('defaut', 60, 10, 0, 8)), true);
  assert.equal(utilisePeage(v('sans_peage', 90, 15, 0, 0)), false);
});

test('sans préférence : équivaut au curseur temps↔argent sur tout le jeu, préférences respectées', () => {
  const rapideCher = v('defaut', 60, 10, 30, 0); // 40 €, 1 h
  const lentGratuit = v('sans_ferry', 150, 15, 0, 0); // 15 €, 2 h 30
  // valeurTemps faible (5 €/h) → la moins chère l'emporte
  const r = selectionnerVariante([rapideCher, lentGratuit], { valeurTempsEurParHeure: 5 });
  assert.ok(r);
  assert.equal(r.variante, lentGratuit);
  assert.equal(r.preferencesRespectees, true);
});

test('éviter ferry (doux) : retient une variante sans ferry même si le ferry serait moins cher/rapide', () => {
  const ferryRapideBon = v('defaut', 60, 10, 20, 0); // 30 €, 1 h, MAIS ferry
  const terreLentChere = v('sans_ferry', 150, 25, 0, 5); // 30 €, 2 h 30, sans ferry
  const r = selectionnerVariante([ferryRapideBon, terreLentChere], {
    valeurTempsEurParHeure: 50, // curseur « temps » qui, seul, choisirait le ferry
    eviterFerry: true,
  });
  assert.ok(r);
  assert.equal(r.variante, terreLentChere);
  assert.equal(r.preferencesRespectees, true);
});

test('éviter ferry ET péage : retient la variante qui évite les deux', () => {
  const ferry = v('defaut', 60, 10, 20, 0);
  const peage = v('sans_ferry', 90, 12, 0, 9);
  const propre = v('sans_peage', 120, 18, 0, 0);
  const r = selectionnerVariante([ferry, peage, propre], {
    valeurTempsEurParHeure: 30,
    eviterFerry: true,
    eviterPeage: true,
  });
  assert.ok(r);
  assert.equal(r.variante, propre);
  assert.equal(r.preferencesRespectees, true);
});

test('parmi les variantes conformes, le curseur temps↔argent tranche encore', () => {
  const terreLente = v('sans_ferry', 180, 10, 0, 0); // 10 €, 3 h, sans ferry
  const terreRapide = v('sans_ferry', 90, 25, 0, 0); // 25 €, 1 h 30, sans ferry
  // valeurTemps élevé (60 €/h) → parmi les conformes (sans ferry), la plus rapide
  const r = selectionnerVariante([terreLente, terreRapide], {
    valeurTempsEurParHeure: 60,
    eviterFerry: true,
  });
  assert.ok(r);
  assert.equal(r.variante, terreRapide);
  assert.equal(r.preferencesRespectees, true);
});

test('éviter ferry STRICT sans aucune variante sans-ferry : infaisable → null (R1, on ne ment pas)', () => {
  const ferry1 = v('defaut', 60, 10, 20, 0);
  const ferry2 = v('defaut', 80, 8, 15, 0);
  const r = selectionnerVariante([ferry1, ferry2], {
    valeurTempsEurParHeure: 30,
    eviterFerry: true,
    strict: true,
  });
  assert.equal(r, null);
});

test('éviter ferry DOUX sans variante conforme : repli sur le meilleur global, préférences NON respectées', () => {
  const ferry1 = v('defaut', 60, 10, 20, 0); // 30 €
  const ferry2 = v('defaut', 120, 8, 5, 0); // 13 €
  const r = selectionnerVariante([ferry1, ferry2], {
    valeurTempsEurParHeure: 5, // curseur « argent » → le moins cher
    eviterFerry: true, // doux : ne peut être honoré, on le signale
  });
  assert.ok(r);
  assert.equal(r.variante, ferry2);
  assert.equal(r.preferencesRespectees, false);
});

test('jeu vide : erreur (précondition, comme choisirVariante)', () => {
  assert.throws(() => selectionnerVariante([], { valeurTempsEurParHeure: 10 }), /au moins une variante/);
});
