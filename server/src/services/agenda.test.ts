// TDD (M004) : logique pure de l'agenda — dérivations (heure→minutes, moment, densité, type de nuit) et mapping
// build_agenda brut → AgendaVoyage. Sans DB ni sidecar. Contrat = shared cafb053 (M527).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hhmmVersMin,
  groupeMoment,
  densiteDe,
  typeNuitDe,
  construireAgenda,
} from './agenda.js';
import type { EtapeAgendaBrute } from '../domain/agenda.js';

test('hhmmVersMin convertit ou rend null', () => {
  assert.equal(hhmmVersMin('08:30'), 510);
  assert.equal(hhmmVersMin('00:00'), 0);
  assert.equal(hhmmVersMin('22:30'), 1350);
  assert.equal(hhmmVersMin('nope'), null);
  assert.equal(hhmmVersMin(undefined), null);
});

test('groupeMoment classe par tranche horaire', () => {
  assert.equal(groupeMoment('08:00'), 'matin');
  assert.equal(groupeMoment('12:30'), 'midi');
  assert.equal(groupeMoment('15:00'), 'apres_midi');
  assert.equal(groupeMoment('19:00'), 'soir');
  assert.equal(groupeMoment(undefined), 'matin');
});

test('densiteDe reflète le ratio consommé/budget', () => {
  assert.equal(densiteDe(30, 120), 'souple');
  assert.equal(densiteDe(60, 120), 'modere');
  assert.equal(densiteDe(100, 120), 'soutenue');
  assert.equal(densiteDe(130, 120), 'depasse');
  assert.equal(densiteDe(null, 120), undefined);
  assert.equal(densiteDe(60, null), undefined);
});

test('typeNuitDe mappe ou défaut camping', () => {
  assert.equal(typeNuitDe('autonomie'), 'autonomie');
  assert.equal(typeNuitDe('aire'), 'aire');
  assert.equal(typeNuitDe('confort'), 'confort');
  assert.equal(typeNuitDe('camping'), 'camping');
  assert.equal(typeNuitDe(undefined), 'camping');
});

const ETAPE: EtapeAgendaBrute = {
  jour: 2,
  date: '2027-08-05',
  base_id: 21,
  nuitee_type: 'camping',
  lever: '08:00',
  coucher: '22:00',
  circuit: {
    nom: 'Autour du Sognefjord',
    segments: [
      { ordre: 1, mode: 'marche', type: 'visite', heure_debut: '09:30', duree_min: 120, note: 'Randonnée au belvédère' },
      { ordre: 2, mode: 'route', type: 'repas', heure_debut: '13:00', duree_min: 60, note: 'Pique-nique' },
      { ordre: 3, mode: 'ferry', type: 'transit', heure_debut: '18:40', duree_min: 0, note: 'Traversée' },
    ],
  },
  resume_jour: { activites: ['a', 'b'], picnic: true, n_activites: 2, circuit_nom: 'Autour du Sognefjord', climax: true },
};

test('construireAgenda mappe un jour complet', () => {
  const a = construireAgenda([ETAPE]);
  assert.equal(a.jours.length, 1);
  const j = a.jours[0]!;
  assert.equal(j.jour, 2);
  assert.equal(j.date, '2027-08-05');
  assert.equal(j.base_id, 21);
  assert.equal(j.lieu, 'Autour du Sognefjord');
  assert.equal(j.perle, true, 'climax → perle');
  assert.equal(j.theme, null, 'thème non calculé → null (R1)');
  assert.equal(j.budget_temps_min, 14 * 60, 'coucher - lever');
  assert.equal(j.temps_consomme_min, 180, 'somme des durées');
  assert.equal(j.confort.type_nuit, 'camping');
  assert.equal(j.confort.cout_nuit_eur, null, 'coût-nuit non calculé → null');
});

test('construireAgenda mappe et regroupe les activités', () => {
  const j = construireAgenda([ETAPE]).jours[0]!;
  assert.equal(j.activites.length, 3);
  assert.equal(j.activites[0]!.groupe_moment, 'matin');
  assert.equal(j.activites[1]!.groupe_moment, 'midi');
  assert.equal(j.activites[2]!.groupe_moment, 'soir');
  assert.equal(j.activites[2]!.contrainte, 'dure', 'ferry/transit = ancre dure');
  assert.equal(j.activites[1]!.contrainte, 'heure', 'repas = heure');
  assert.equal(j.activites[0]!.contrainte, 'souple');
  assert.equal(j.activites[0]!.cout_eur, null, 'enveloppe payante = v3.1 → null');
});

test('construireAgenda pose les ancres et le budget total', () => {
  const depart: EtapeAgendaBrute = { jour: 1, circuit: { nom: 'Arrivée à Kristiansand (ferry)', segments: [] }, lever: '08:00', coucher: '22:00' };
  const retour: EtapeAgendaBrute = { jour: 3, circuit: { nom: 'Retour à Kristiansand (ferry)', segments: [] }, lever: '08:00', coucher: '16:00' };
  const a = construireAgenda([depart, ETAPE, retour]);
  assert.equal(a.ancre_depart, 'Arrivée à Kristiansand (ferry)');
  assert.equal(a.ancre_retour, 'Retour à Kristiansand (ferry)');
  assert.equal(a.budget_temps_total_min, 14 * 60 + 14 * 60 + 8 * 60, 'somme des budgets-temps');
});

test('construireAgenda tolère un agenda vide', () => {
  const a = construireAgenda([]);
  assert.deepEqual(a.jours, []);
  assert.equal(a.ancre_depart, null);
  assert.equal(a.budget_temps_total_min, null);
});
