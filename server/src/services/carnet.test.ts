// TDD (M004) : validation pure de l'ajout d'un lieu par un voyageur (api.ajouter_poi), avant tout appel DB.
// Un ajout de POI est gaté PIN (corrections/ajouts de POI, A03/M052) : le pin est requis. nom + coordonnées WGS84.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validerAjoutPoi } from './carnet.js';
import { ErreurRequete } from '../http/erreurs.js';

test('validerAjoutPoi accepte un ajout minimal valide', () => {
  const v = validerAjoutPoi({ pin: '1234', nom: 'Cascade cachée', lon: 6.1, lat: 60.2 });
  assert.deepEqual(v, {
    pin: '1234',
    nom: 'Cascade cachée',
    lon: 6.1,
    lat: 60.2,
    categorie: null,
    sous_categorie: null,
    presentation: null,
  });
});

test('validerAjoutPoi conserve les champs optionnels fournis', () => {
  const v = validerAjoutPoi({
    pin: 'abcd',
    nom: 'Point de vue',
    lon: 5,
    lat: 59,
    categorie: 'paysage',
    presentation: 'Belle halte.',
  });
  assert.equal(v.categorie, 'paysage');
  assert.equal(v.presentation, 'Belle halte.');
  assert.equal(v.sous_categorie, null);
});

test('validerAjoutPoi refuse pin ou nom manquant', () => {
  assert.throws(() => validerAjoutPoi({ nom: 'X', lon: 6, lat: 60 }), ErreurRequete);
  assert.throws(() => validerAjoutPoi({ pin: '1', lon: 6, lat: 60 }), ErreurRequete);
  assert.throws(() => validerAjoutPoi({ pin: '1', nom: '   ', lon: 6, lat: 60 }), ErreurRequete);
});

test('validerAjoutPoi refuse des coordonnées absentes ou hors bornes WGS84', () => {
  assert.throws(() => validerAjoutPoi({ pin: '1', nom: 'X', lat: 60 }), ErreurRequete);
  assert.throws(() => validerAjoutPoi({ pin: '1', nom: 'X', lon: 6, lat: 999 }), ErreurRequete);
  assert.throws(() => validerAjoutPoi({ pin: '1', nom: 'X', lon: 'six', lat: 60 }), ErreurRequete);
});
