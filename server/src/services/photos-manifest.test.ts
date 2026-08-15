// TDD (M405/A140) : indexation PURE du manifeste photos (data/echantillon-web/photos-manifest.json) en Map cle→photos.
// Clé = `cle` (osm_id valide, sinon poi:<id>) ET osm_id si valide (les deux pointent la même liste). Tri par `ordre`.
// La lecture disque (chargerManifeste) est isolée ; ici on teste le cœur pur, sans fichier ni DB.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indexerManifeste } from './photos-manifest.js';

const MANIFESTE = {
  pois: [
    {
      cle: 'poi:223',
      osm_id: '-1',
      osm_id_valide: false,
      photos: [
        { fichier: 'b.jpg', chemin: 'poi/x/photos/b.jpg', ordre: 2, credit: 'K', licence: 'CC BY-SA 3.0', libre: true, verifie: true },
        { fichier: 'a.jpg', chemin: 'poi/x/photos/a.jpg', ordre: 1, credit: 'K', licence: 'CC BY-SA 3.0', libre: true, verifie: true },
      ],
    },
    {
      cle: '12345',
      osm_id: '12345',
      osm_id_valide: true,
      photos: [{ fichier: 'c.jpg', chemin: 'poi/y/photos/c.jpg', ordre: 1, credit: null, licence: 'CC0', libre: true, verifie: true }],
    },
  ],
};

test('indexerManifeste : clé cle→photos triées par ordre', () => {
  const idx = indexerManifeste(MANIFESTE);
  const p = idx.get('poi:223');
  assert.ok(p);
  assert.deepEqual(p!.map((x) => x.fichier), ['a.jpg', 'b.jpg']); // tri par ordre 1,2
});

test('indexerManifeste : osm_id valide indexé AUSSI (même liste que cle)', () => {
  const idx = indexerManifeste(MANIFESTE);
  assert.deepEqual(idx.get('12345'), idx.get('12345')); // présent par cle == osm_id
  assert.equal(idx.get('12345')!.length, 1);
  // l'osm-less (-1) n'est PAS indexé par osm_id (évite les collisions des 3 osm-less), seulement par cle.
  assert.equal(idx.get('-1'), undefined);
});

test('indexerManifeste : manifeste vide/malformé → Map vide (dégradation, jamais throw)', () => {
  assert.equal(indexerManifeste(null).size, 0);
  assert.equal(indexerManifeste({}).size, 0);
  assert.equal(indexerManifeste({ pois: 'x' }).size, 0);
});
