// TDD (M004) : logique pure du budget vivant — classification poste, statut, mapping réservation, assemblage 3 sources.
// Sans DB. Contrat = shared 41903c8 (M547). Total EUR-only, NOK indicatif.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  posteDeType,
  statutDe,
  mapReservation,
  construireBudgetVivant,
} from './budget-vivant.js';
import type { BudgetComparatif, ReservationBrute } from '../domain/budget-vivant.js';

test('posteDeType classe les types courants', () => {
  assert.equal(posteDeType('ferry international'), 'ferry_international');
  assert.equal(posteDeType('ferry'), 'ferry_interieur');
  assert.equal(posteDeType('kayak'), 'activites');
  assert.equal(posteDeType('camping'), 'hebergement');
  assert.equal(posteDeType('péage'), 'peages');
  assert.equal(posteDeType(null), 'hebergement');
});

test('statutDe normalise ou défaut pressenti', () => {
  assert.equal(statutDe('reserve'), 'reserve');
  assert.equal(statutDe('PAYE'), 'paye');
  assert.equal(statutDe('inconnu'), 'pressenti');
  assert.equal(statutDe(null), 'pressenti');
});

test('mapReservation en EUR garde le montant', () => {
  const r: ReservationBrute = { id: 1, type: 'camping', libelle: 'Camping X', date_arr: '2027-08-06', statut: 'reserve', montant: 320, devise: 'EUR', note: null };
  const m = mapReservation(r);
  assert.equal(m.poste, 'hebergement');
  assert.equal(m.montant_eur, 320);
  assert.equal(m.montant_nok, null);
  assert.equal(m.statut, 'reserve');
  assert.equal(m.date, '2027-08-06');
});

test('mapReservation en NOK convertit indicatif et garde le NOK', () => {
  const r: ReservationBrute = { id: 2, type: 'ferry', libelle: 'Fjord Line', date_arr: null, statut: 'acompte', montant: 1000, devise: 'NOK', note: null };
  const m = mapReservation(r);
  assert.equal(m.poste, 'ferry_interieur');
  assert.equal(m.montant_nok, 1000);
  assert.equal(m.montant_eur, 86, '1000 NOK × 0.086 = 86 €');
});

const COMP: BudgetComparatif = {
  fige_id: 7, code: null, label: null, source: 's', archetype_key: null, prenom: null,
  km: 3000, nuits: 21,
  postes: { van: 2800, activites: 400, carburant: 600, hebergement: 900, repas_courses: 1200, ferry_interieur: 300, ferry_international: 686 },
  par_adulte: {} as never, alertes: {} as never,
  total_prudent_eur: 8000, total_non_prudent_eur: 6800,
};

test('construireBudgetVivant confronte les 3 sources', () => {
  const resa = [mapReservation({ id: 1, type: 'ferry', libelle: 'F', date_arr: null, statut: 'paye', montant: 686, devise: 'EUR', note: null })];
  const b = construireBudgetVivant(COMP, resa, { soft_cap_eur: 7500, hard_cap_eur: 9000 });
  assert.equal(b.total_min_eur, 6800, 'itinéraire brut');
  assert.equal(b.total_max_eur, 8000, 'avec marges');
  assert.equal(b.total_engage_eur, 686, 'somme réservations');
  assert.equal(b.reste_eur, 8000 - 686);
  assert.equal(b.sources.length, 3);
  assert.equal(b.sources.find((s) => s.source === 'reservations')!.montant_eur, 686);
  assert.equal(b.soft_cap_eur, 7500);
  assert.equal(b.devise, 'EUR');
  assert.deepEqual(b.suivi, [], 'suivi vide tant que non saisi (R1)');
});

test('construireBudgetVivant sans comparatif reste cohérent (postes zéro)', () => {
  const b = construireBudgetVivant(null, [], { soft_cap_eur: null, hard_cap_eur: null });
  assert.equal(b.total_min_eur, 0);
  assert.equal(b.total_max_eur, 0);
  assert.equal(b.total_engage_eur, 0);
  assert.equal(b.postes.van, 0);
  assert.equal(b.reservations.length, 0);
});
