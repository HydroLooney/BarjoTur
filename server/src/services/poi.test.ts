// TDD (M004) : ce test précède parseBbox. Logique pure de validation d'une emprise (bbox) reçue en query string,
// avant tout appel DB. Bornes géographiques WGS84 et min < max.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBbox } from './poi.js';
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
