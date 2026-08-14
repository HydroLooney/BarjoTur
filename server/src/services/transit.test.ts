// TDD (M055) : la règle « réservation ⇒ jalon imposé » et les arrêts imposés du faisceau de transit. Pur, sans DB.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { epinglerReserves, normaliserEtapesTransit, arretsImposes } from './transit.js';
import type { ArretTransit, EtapeTransit } from '../domain/voyage.js';

function arret(id: string, o: Partial<ArretTransit> = {}): ArretTransit {
  return { id, label: id, lat: 60, lon: 8, epingle: false, reserve: false, autonomie: true, ...o };
}

test('epinglerReserves épingle tout arrêt réservé', () => {
  const out = epinglerReserves([arret('a', { reserve: true }), arret('b')]);
  assert.equal(out.find((x) => x.id === 'a')!.epingle, true);
  assert.equal(out.find((x) => x.id === 'b')!.epingle, false);
});

test('epinglerReserves conserve un épinglage manuel (ne dé-épingle jamais)', () => {
  const out = epinglerReserves([arret('a', { epingle: true, reserve: false })]);
  assert.equal(out[0]!.epingle, true);
});

test('epinglerReserves est pur (ne mute pas l’entrée)', () => {
  const src = [arret('a', { reserve: true })];
  const avant = JSON.stringify(src);
  epinglerReserves(src);
  assert.equal(JSON.stringify(src), avant);
});

test('arretsImposes ne rend que les arrêts épinglés (manuels + réservés)', () => {
  const f = [arret('a', { reserve: true }), arret('b', { epingle: true }), arret('c')];
  const imposes = arretsImposes(f).map((x) => x.id).sort();
  assert.deepEqual(imposes, ['a', 'b']);
});

test('normaliserEtapesTransit applique l’épinglage à chaque faisceau', () => {
  const etapes: EtapeTransit[] = [
    { id: 'e1', ordre: 1, depuis: { label: 'x', lat: 60, lon: 8 }, vers: { label: 'y', lat: 61, lon: 9 }, jalon_date: null, faisceau: [arret('a', { reserve: true })] },
  ];
  const out = normaliserEtapesTransit(etapes);
  assert.equal(out[0]!.faisceau[0]!.epingle, true);
});
