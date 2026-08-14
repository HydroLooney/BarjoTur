// TDD (M004/M047) : engine de la machine à crans, PUR, sans DB. Gardes de rôle, ordre de validation, verrouillage,
// réouverture avec invalidation de l'aval modifiable (et préservation de l'aval verrouillé), immutabilité de l'entrée.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appliquerTransition, validerTransition, parseVoyageId, type ContexteTransition } from './parcours.js';
import { parcoursNeuf } from '../domain/parcours.js';
import type { ActionCran, CranId, EtatParcours } from '../domain/parcours.js';
import { ErreurRequete } from '../http/erreurs.js';

const ORG: ContexteTransition = { role: 'organisateur', par: 7, maintenant: '2026-08-14T10:00:00Z' };

function etatAvec(id: CranId): string {
  return id;
}

/** Applique une chaîne de transitions (organisateur), en s'assurant que chacune réussit. */
function enchaine(etat: EtatParcours, etapes: Array<[ActionCran, CranId]>): EtatParcours {
  let e = etat;
  for (const [action, cran] of etapes) {
    const r = appliquerTransition(e, action, cran, ORG);
    assert.ok(r.ok, `transition ${action} ${cran} devrait réussir : ${r.raison ?? ''}`);
    e = r.etat!;
  }
  return e;
}

test('refuse toute transition à un rôle non organisateur', () => {
  const e = parcoursNeuf(1);
  for (const role of ['voyageur', 'demo', 'invite']) {
    const r = appliquerTransition(e, 'valider', 'cadrage', { ...ORG, role });
    assert.equal(r.ok, false);
    assert.match(r.raison ?? '', /organisateur/i);
  }
  // organisateur_principal est bien organisateur
  assert.equal(appliquerTransition(e, 'valider', 'cadrage', { ...ORG, role: 'organisateur_principal' }).ok, true);
});

test('valider fait passer brouillon → valide_modifiable et horodate', () => {
  const e = parcoursNeuf(1);
  const r = appliquerTransition(e, 'valider', 'cadrage', ORG);
  assert.ok(r.ok);
  const cadrage = r.etat!.crans.find((c) => c.id === 'cadrage')!;
  assert.equal(cadrage.etat, 'valide_modifiable');
  assert.equal(cadrage.valide_at, '2026-08-14T10:00:00Z');
  assert.equal(cadrage.valide_par, 7);
  assert.equal(r.etat!.cran_courant, 'reservation_van'); // avance au premier brouillon
});

test('valider hors ordre (amont non validé) est refusé', () => {
  const e = parcoursNeuf(1);
  const r = appliquerTransition(e, 'valider', 'exploration', ORG); // cadrage + reservation_van encore brouillon
  assert.equal(r.ok, false);
  assert.match(r.raison ?? '', /amont/i);
});

test('valider un cran déjà validé est refusé', () => {
  const e = enchaine(parcoursNeuf(1), [['valider', 'cadrage']]);
  const r = appliquerTransition(e, 'valider', 'cadrage', ORG);
  assert.equal(r.ok, false);
});

test('verrouiller exige un cran déjà validé, puis fige', () => {
  const e0 = parcoursNeuf(1);
  assert.equal(appliquerTransition(e0, 'verrouiller', 'cadrage', ORG).ok, false); // brouillon
  const e1 = enchaine(e0, [['valider', 'cadrage']]);
  const r = appliquerTransition(e1, 'verrouiller', 'cadrage', ORG);
  assert.ok(r.ok);
  assert.equal(r.etat!.crans.find((c) => c.id === 'cadrage')!.etat, 'valide_verrouille');
  // re-verrouiller est refusé
  assert.equal(appliquerTransition(r.etat!, 'verrouiller', 'cadrage', ORG).ok, false);
});

test('rouvrir un cran modifiable invalide l’aval modifiable et pose le courant', () => {
  const e = enchaine(parcoursNeuf(1), [
    ['valider', 'cadrage'],
    ['valider', 'reservation_van'],
    ['valider', 'exploration'],
    ['valider', 'composition'],
    ['valider', 'logistique'],
  ]);
  const r = appliquerTransition(e, 'rouvrir', 'exploration', ORG);
  assert.ok(r.ok);
  assert.deepEqual(r.aval_invalide, ['composition', 'logistique']);
  assert.equal(r.etat!.cran_courant, 'exploration');
  assert.equal(r.etat!.crans.find((c) => c.id === 'exploration')!.etat, 'brouillon');
  assert.equal(r.etat!.crans.find((c) => c.id === 'composition')!.etat, 'brouillon');
  // l'amont (reservation_van, irréversible) reste figé, non touché par la réouverture aval
  assert.equal(r.etat!.crans.find((c) => c.id === 'reservation_van')!.etat, 'valide_verrouille');
});

test('rouvrir préserve l’aval VERROUILLÉ (fait extérieur), invalide seulement le modifiable', () => {
  let e = enchaine(parcoursNeuf(1), [
    ['valider', 'cadrage'],
    ['valider', 'reservation_van'],
    ['valider', 'exploration'],
    ['valider', 'composition'],
    ['valider', 'logistique'],
  ]);
  e = appliquerTransition(e, 'verrouiller', 'logistique', ORG).etat!; // aval verrouillé
  const r = appliquerTransition(e, 'rouvrir', 'exploration', ORG);
  assert.ok(r.ok);
  assert.deepEqual(r.aval_invalide, ['composition']); // logistique NON invalidé
  assert.equal(r.etat!.crans.find((c) => c.id === 'logistique')!.etat, 'valide_verrouille');
});

test('valider un cran irréversible le fige directement en valide_verrouille (reservation_van)', () => {
  const e = enchaine(parcoursNeuf(1), [['valider', 'cadrage'], ['valider', 'reservation_van']]);
  assert.equal(e.crans.find((c) => c.id === 'reservation_van')!.etat, 'valide_verrouille');
});

test('rouvrir un cran irréversible est refusé, quel que soit son état (reservation_van)', () => {
  const e = enchaine(parcoursNeuf(1), [['valider', 'cadrage'], ['valider', 'reservation_van']]);
  const r = appliquerTransition(e, 'rouvrir', 'reservation_van', ORG); // déjà valide_verrouille + reouvrable:false
  assert.equal(r.ok, false);
  assert.match(r.raison ?? '', /irréversible|non rouvrable/i);
});

test('rouvrir un cran verrouillé mais REOUVRABLE est autorisé (cadrage)', () => {
  let e = enchaine(parcoursNeuf(1), [['valider', 'cadrage']]);
  e = appliquerTransition(e, 'verrouiller', 'cadrage', ORG).etat!; // cadrage.reouvrable = true
  const r = appliquerTransition(e, 'rouvrir', 'cadrage', ORG);
  assert.ok(r.ok);
  assert.equal(r.etat!.crans.find((c) => c.id === 'cadrage')!.etat, 'brouillon');
});

test('rouvrir un cran en brouillon est refusé', () => {
  const r = appliquerTransition(parcoursNeuf(1), 'rouvrir', 'cadrage', ORG);
  assert.equal(r.ok, false);
});

test('l’engine ne mute jamais l’état d’entrée (pureté)', () => {
  const e = parcoursNeuf(1);
  const avant = JSON.stringify(e);
  appliquerTransition(e, 'valider', 'cadrage', ORG);
  assert.equal(JSON.stringify(e), avant);
});

test('validerTransition accepte un corps valide et refuse le reste', () => {
  assert.deepEqual(validerTransition({ code: 'abc', pin: '1234', action: 'valider', cran: 'cadrage' }), {
    code: 'abc',
    pin: '1234',
    action: 'valider',
    cran: etatAvec('cadrage'),
  });
  assert.throws(() => validerTransition({ pin: '1', action: 'valider', cran: 'cadrage' }), ErreurRequete); // code manquant
  assert.throws(() => validerTransition({ code: 'abc', action: 'valider', cran: 'cadrage' }), ErreurRequete); // pin manquant
  assert.throws(() => validerTransition({ code: 'abc', pin: '1', action: 'supprimer', cran: 'cadrage' }), ErreurRequete);
  assert.throws(() => validerTransition({ code: 'abc', pin: '1', action: 'valider' }), ErreurRequete);
  assert.throws(() => validerTransition({ code: 'abc', pin: '1', action: 'valider', cran: '  ' }), ErreurRequete);
  assert.throws(() => validerTransition(null), ErreurRequete);
});

test('parseVoyageId accepte un entier positif, refuse le reste', () => {
  assert.equal(parseVoyageId('42'), 42);
  assert.throws(() => parseVoyageId('0'), ErreurRequete);
  assert.throws(() => parseVoyageId('-3'), ErreurRequete);
  assert.throws(() => parseVoyageId('abc'), ErreurRequete);
  assert.throws(() => parseVoyageId('1.5'), ErreurRequete);
});
