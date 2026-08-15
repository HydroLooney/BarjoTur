// TDD (M059) : orchestration de l'itinéraire mixte expérience/transit. Sans DB ni sidecar (routeur injecté).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validerEtapesItineraire,
  validerEtapeTransit,
  arretsImposesPourCompose,
  orchestrerItineraire,
  sequenceReservationBases,
} from './itineraire.js';
import type { EtapeItineraire } from '../domain/itineraire.js';
import type { ArretTransit, EtapeTransit } from '../domain/voyage.js';
import type { ArretImpose, ComposeInput, ComposeReponse } from '../domain/composeur.js';
import { ErreurRequete } from '../http/erreurs.js';

const P = { label: 'x', lat: 60, lon: 8 };
function arret(id: string, o: Partial<ArretTransit> = {}): ArretTransit {
  return { id, label: id, lat: 60, lon: 8, epingle: false, reserve: false, autonomie: true, ...o };
}
function etapeTransit(o: Partial<EtapeTransit> = {}): EtapeTransit {
  return { id: 't1', ordre: 1, depuis: P, vers: { label: 'y', lat: 61, lon: 9 }, jalon_date: null, faisceau: [], ...o };
}

test('validerEtapesItineraire refuse une liste vide ou une nature inconnue', () => {
  assert.throws(() => validerEtapesItineraire({ etapes: [] }), ErreurRequete);
  assert.throws(() => validerEtapesItineraire({ etapes: [{ nature: 'sieste' }] }), ErreurRequete);
  assert.throws(() => validerEtapesItineraire({}), ErreurRequete);
});

test('validerEtapesItineraire accepte une séquence expérience + transit', () => {
  const out = validerEtapesItineraire({
    etapes: [
      { nature: 'experience', experience: { bases: [1, 2] } },
      { nature: 'transit', transit: etapeTransit() },
    ],
  });
  assert.equal(out.length, 2);
  assert.equal(out[0]!.nature, 'experience');
  assert.equal(out[1]!.nature, 'transit');
});

test('validerEtapeTransit exige des points depuis/vers valides', () => {
  assert.throws(() => validerEtapeTransit({ depuis: { label: 'x' }, vers: P, faisceau: [] }), ErreurRequete);
  assert.throws(() => validerEtapeTransit({ depuis: P, vers: P, faisceau: 'non' }), ErreurRequete);
  const ok = validerEtapeTransit({ depuis: P, vers: P, faisceau: [], jalon_date: '2027-08-04T18:40:00Z' });
  assert.equal(ok.jalon_date, '2027-08-04T18:40:00Z');
});

test('validerEtapeTransit câble budget_min (M305) : nombre préservé, null/absent → null, type invalide → 400', () => {
  assert.equal(validerEtapeTransit({ depuis: P, vers: P, faisceau: [], budget_min: 120 }).budget_min, 120);
  assert.equal(validerEtapeTransit({ depuis: P, vers: P, faisceau: [] }).budget_min, null);
  assert.equal(validerEtapeTransit({ depuis: P, vers: P, faisceau: [], budget_min: null }).budget_min, null);
  assert.throws(() => validerEtapeTransit({ depuis: P, vers: P, faisceau: [], budget_min: 'x' }), ErreurRequete);
  assert.throws(() => validerEtapeTransit({ depuis: P, vers: P, faisceau: [], budget_min: -5 }), ErreurRequete);
});

test('arretsImposesPourCompose traduit les arrêts imposés en contrainte {lat,lon}', () => {
  const out = arretsImposesPourCompose([arret('a', { reserve: true }), arret('b')]);
  assert.deepEqual(out, [{ lat: 60, lon: 8 }]); // seul le réservé est imposé
});

test('orchestrerItineraire rend une suite EtapeRoutee typée (expérience routée, transit en attente)', async () => {
  const geom = { type: 'LineString', coordinates: [[8, 60], [9, 61]] } as ComposeReponse['geom'];
  const meta = { n_bases: 2, nuits: 3, value: 10, drive_h: 4 } as ComposeReponse['compose'];
  const faux: ComposeReponse = { ok: true, geom, compose: meta } as ComposeReponse;
  const appels: ComposeInput[] = [];
  const routeur = async (input: ComposeInput): Promise<ComposeReponse> => {
    appels.push(input);
    return faux;
  };
  const etapes: EtapeItineraire[] = [
    { nature: 'experience', experience: { bases: [1, 2] } },
    { nature: 'transit', transit: etapeTransit({ faisceau: [arret('a', { reserve: true })] }) },
    { nature: 'experience', experience: { bases: [3] } },
  ];
  const res = await orchestrerItineraire(etapes, routeur);
  assert.equal(res.ok, true);
  assert.equal(res.etapes.length, 3);
  assert.equal(res.transit_en_attente, 1);
  assert.equal(appels.length, 2); // deux étapes expérience routées
  assert.equal(res.etapes[0]!.nature, 'experience');
  assert.equal(res.etapes[0]!.statut, 'route');
  assert.equal(res.etapes[0]!.geom, geom);
  assert.equal(res.etapes[0]!.meta, meta);
  assert.equal(res.etapes[1]!.nature, 'transit');
  assert.equal(res.etapes[1]!.statut, 'en_attente_corridor');
  assert.deepEqual(res.etapes.map((e) => e.ordre), [0, 1, 2]); // ordre préservé
});

// A* réservation (A33) : une réservation confirmée = jalon imposé, waypoint OBLIGATOIRE du routage A* base-à-base.
function imp(base_id: number | null, lat = 60, lon = 8): ArretImpose {
  return { base_id, lat, lon };
}

test('sequenceReservationBases sans imposé : simple départ→arrivée', () => {
  const r = sequenceReservationBases(10, 20, []);
  assert.deepEqual(r.bases, [10, 20]);
  assert.deepEqual(r.imposes_non_routables, []);
});

test('sequenceReservationBases insère les imposés routables dans l’ordre entre départ et arrivée', () => {
  const r = sequenceReservationBases(10, 20, [imp(15), imp(17)]);
  assert.deepEqual(r.bases, [10, 15, 17, 20]);
  assert.deepEqual(r.imposes_non_routables, []);
});

test('sequenceReservationBases écarte et SIGNALE les imposés sans base_id (non routables sur le graphe, R1)', () => {
  const sansBase = imp(null, 61, 9);
  const r = sequenceReservationBases(10, 20, [imp(15), sansBase]);
  assert.deepEqual(r.bases, [10, 15, 20]);
  assert.deepEqual(r.imposes_non_routables, [sansBase]);
});

test('sequenceReservationBases fusionne les doublons consécutifs (imposé == départ/arrivée)', () => {
  const r = sequenceReservationBases(10, 20, [imp(10), imp(15), imp(20)]);
  assert.deepEqual(r.bases, [10, 15, 20]); // 10 et 20 non redoublés
});

test('sequenceReservationBases : deux imposés identiques consécutifs ne se répètent pas', () => {
  const r = sequenceReservationBases(10, 20, [imp(15), imp(15)]);
  assert.deepEqual(r.bases, [10, 15, 20]);
});
