// TDD (M004) : ce test précède parseBbox. Logique pure de validation d'une emprise (bbox) reçue en query string,
// avant tout appel DB. Bornes géographiques WGS84 et min < max.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBbox, validerCle } from './poi.js';
import { ErreurRequete } from '../http/erreurs.js';

test('parseBbox accepte une emprise valide et rend des nombres', () => {
  const b = parseBbox({ minlon: '5', minlat: '58', maxlon: '7', maxlat: '61' });
  assert.deepEqual(b, { minlon: 5, minlat: 58, maxlon: 7, maxlat: 61 });
});

test('parseBbox accepte des longitudes négatives (ouest) et des décimales', () => {
  const b = parseBbox({ minlon: '-2.5', minlat: '58.1', maxlon: '10.9', maxlat: '71' });
  assert.deepEqual(b, { minlon: -2.5, minlat: 58.1, maxlon: 10.9, maxlat: 71 });
});

test('parseBbox refuse un paramètre manquant ou non numérique', () => {
  assert.throws(() => parseBbox({ minlon: '5', minlat: '58', maxlon: '7' }), ErreurRequete);
  assert.throws(() => parseBbox({ minlon: 'x', minlat: '58', maxlon: '7', maxlat: '61' }), ErreurRequete);
});

test('parseBbox refuse hors bornes WGS84', () => {
  assert.throws(() => parseBbox({ minlon: '-200', minlat: '58', maxlon: '7', maxlat: '61' }), ErreurRequete);
  assert.throws(() => parseBbox({ minlon: '5', minlat: '-91', maxlon: '7', maxlat: '61' }), ErreurRequete);
});

test('parseBbox refuse min >= max', () => {
  assert.throws(() => parseBbox({ minlon: '7', minlat: '58', maxlon: '5', maxlat: '61' }), ErreurRequete);
  assert.throws(() => parseBbox({ minlon: '5', minlat: '61', maxlon: '7', maxlat: '58' }), ErreurRequete);
});

test('lireRecos (M379/M426) : passe-plat → RecosReponse { recos: Reco[] } ; RPC absente → { recos: [] }', async () => {
  const { lireRecos } = await import('./poi.js');
  const { appelerRpc } = await import('../db/rpc.js');
  type Rpc = typeof appelerRpc;
  const recos = [{ cle: 'p:3', nom: 'Besseggen', lat: 61.3, lon: 8.5, sous_zone_id: 'jotunheimen__7', rang: 1 }];
  const fakeRpc = ((async () => recos) as unknown) as Rpc;
  const rpcAbsente = ((async () => { const e = new Error() as Error & { code?: string }; e.code = '42883'; throw e; }) as unknown) as Rpc;
  assert.deepEqual(await lireRecos('CODE', fakeRpc), { recos } as never);
  assert.deepEqual(await lireRecos('CODE', rpcAbsente), { recos: [] });
});

test('validerCle (M405) : osm_id / poi:<id> OK ; vide ou charset interdit = 400', () => {
  assert.equal(validerCle('12345'), '12345');
  assert.equal(validerCle('-1'), '-1');
  assert.equal(validerCle('poi:223'), 'poi:223');
  assert.equal(validerCle('bt:abc'), 'bt:abc');
  assert.throws(() => validerCle(''), ErreurRequete);
  assert.throws(() => validerCle('a b'), ErreurRequete);
  assert.throws(() => validerCle(42), ErreurRequete);
});

test('lirePoiFiche (M405/A140) : détail via RPC ; photos = RPC prioritaire, sinon manifeste, sinon []', async () => {
  const { lirePoiFiche } = await import('./poi.js');
  const { appelerRpc } = await import('../db/rpc.js');
  type Rpc = typeof appelerRpc;
  const detail = { poi_id: 223, cle: 'poi:223', nom: 'Tyholmen', osm_id: null };
  const photosManif = [{ fichier: 'a.jpg', chemin: 'poi/x/a.jpg', ordre: 1, credit: null, licence: 'CC0', libre: true, verifie: true }];
  // RPC poi_detail présent, poi_photos ABSENT (42883) → détail réel + photos du manifeste (injecté).
  const rpcDetailSeul = ((async (fn: string) => {
    if (fn === 'poi_detail') return detail;
    const e = new Error() as Error & { code?: string }; e.code = '42883'; throw e; // poi_photos absent
  }) as unknown) as Rpc;
  assert.deepEqual(await lirePoiFiche('poi:223', rpcDetailSeul, () => photosManif), { detail, photos: photosManif } as never);
  // poi_photos présent → prioritaire sur le manifeste.
  const photosRpc = [{ fichier: 'b.jpg', chemin: 'poi/y/b.jpg', ordre: 1, credit: null, licence: 'CC0', libre: true, verifie: true }];
  const rpcTout = ((async (fn: string) => (fn === 'poi_detail' ? detail : photosRpc)) as unknown) as Rpc;
  assert.deepEqual(await lirePoiFiche('poi:223', rpcTout, () => photosManif), { detail, photos: photosRpc } as never);
  // tout absent (pré-flip, pas de manifeste) → détail null, photos [].
  const rpcAbsent = ((async () => { const e = new Error() as Error & { code?: string }; e.code = '42883'; throw e; }) as unknown) as Rpc;
  assert.deepEqual(await lirePoiFiche('poi:223', rpcAbsent, () => []), { detail: null, photos: [] });
});
