// TDD (M272 §3) : passe-plats carto « prêts-à-câbler » sur le contrat de diffusion B088/M263 (v_web_poi categorie_calque,
// v_web_decoupage niveau/id/parent_id). Parties PURES testables sans DB : validation du niveau ; e2e via RPC injecté
// (fixtures). Les vraies vues arrivent d'A en Passe 2 (dump final) ; d'ici là, RPC absente → 200 vide (dégradation).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validerNiveau,
  lireCalques,
  lireDecoupage,
  lireSentiersDifficultes,
  lireCircuitsCarto,
  lireBasesCarto,
} from './carto.js';
import { appelerRpc } from '../db/rpc.js';
import { ErreurRequete } from '../http/erreurs.js';
import type { CalqueBucket, EntreeDecoupage } from '../domain/carto.js';

type Rpc = typeof appelerRpc;
const fakeRpc = (reponses: Record<string, unknown>): Rpc =>
  (async (fn: string) => {
    if (!(fn in reponses)) throw new Error(`RPC inattendue : ${fn}`);
    return reponses[fn];
  }) as Rpc;
const rpcAbsente: Rpc = (async () => {
  const e = new Error('undefined_function') as Error & { code?: string };
  e.code = '42883';
  throw e;
}) as Rpc;

test('validerNiveau : region|zone|sous_zone, absent = undefined, autre = 400', () => {
  assert.equal(validerNiveau({}), undefined);
  assert.equal(validerNiveau({ niveau: 'region' }), 'region');
  assert.equal(validerNiveau({ niveau: 'sous_zone' }), 'sous_zone');
  assert.throws(() => validerNiveau({ niveau: 'pays' }), ErreurRequete);
  assert.throws(() => validerNiveau({ niveau: 42 }), ErreurRequete);
});

test('lireCalques : passe-plat des buckets categorie_calque (legende/filtre) ; null → []', async () => {
  const buckets: CalqueBucket[] = [
    { categorie_calque: 'cascade', n: 42 },
    { categorie_calque: 'services_van', n: 187 },
  ];
  assert.deepEqual(await lireCalques(fakeRpc({ carto_calques: buckets })), buckets);
  assert.deepEqual(await lireCalques(fakeRpc({ carto_calques: null })), []);
});

test('lireDecoupage : passe-plat niveau/id/parent_id/n_poi, filtre niveau optionnel ; null → []', async () => {
  const entrees: EntreeDecoupage[] = [
    { niveau: 'region', id: 1, parent_id: null, n_poi: 300 },
    { niveau: 'zone', id: 10, parent_id: 1, n_poi: 120 },
  ];
  assert.deepEqual(await lireDecoupage(undefined, fakeRpc({ carto_decoupage: entrees })), entrees);
  assert.deepEqual(await lireDecoupage('zone', fakeRpc({ carto_decoupage: null })), []);
});

test('dégradation propre : vues de diffusion pas encore livrées (42883) → 200 vide, PAS de 500', async () => {
  assert.deepEqual(await lireCalques(rpcAbsente), []);
  assert.deepEqual(await lireDecoupage('region', rpcAbsente), []);
});

test('lireSentiersDifficultes / lireCircuitsCarto / lireBasesCarto : passe-plats ; null → []', async () => {
  const diffs = [{ difficulte: 'moyen', n: 412 }, { difficulte: 'non_grade', n: 88 }];
  assert.deepEqual(await lireSentiersDifficultes(fakeRpc({ carto_sentiers_difficultes: diffs })), diffs);
  assert.deepEqual(await lireSentiersDifficultes(fakeRpc({ carto_sentiers_difficultes: null })), []);
  const circ = [{ circuit_id: 3, nom: 'Besseggen', distance_km: 14, denivele_pos: 1100, tier_defaut: 'S', votable: true }];
  assert.deepEqual(await lireCircuitsCarto(fakeRpc({ carto_circuits: circ })), circ);
  assert.deepEqual(await lireCircuitsCarto(fakeRpc({ carto_circuits: null })), []);
  const bases = [{ base_id: 1, nom: 'Kristiansand', tier_moyen: 'A', nuits_max_faisable: 3 }];
  assert.deepEqual(await lireBasesCarto(fakeRpc({ carto_bases: bases })), bases);
  assert.deepEqual(await lireBasesCarto(fakeRpc({ carto_bases: null })), []);
});

test('dégradation propre (42883) sur sentiers/circuits/bases → 200 vide', async () => {
  assert.deepEqual(await lireSentiersDifficultes(rpcAbsente), []);
  assert.deepEqual(await lireCircuitsCarto(rpcAbsente), []);
  assert.deepEqual(await lireBasesCarto(rpcAbsente), []);
});

test('couches GeoJSON (M367) : passe-plat FeatureCollection ; RPC absente → FC vide (contrat de prod)', async () => {
  const { lireCartoPoiGeojson, lireCartoDecoupageGeojson, lireCartoServicesVanGeojson, lireCartoRoutesSceniquesGeojson, lireCartoSentiersGeojson } = await import('./carto.js');
  const fc = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [8, 60] }, properties: { tier: 'A', confiance: 0.9 } }] };
  assert.deepEqual(await lireCartoPoiGeojson(fakeRpc({ carto_poi_geojson: fc })), fc as never);
  assert.deepEqual(await lireCartoDecoupageGeojson(rpcAbsente), { type: 'FeatureCollection', features: [] });
  assert.deepEqual(await lireCartoServicesVanGeojson(rpcAbsente), { type: 'FeatureCollection', features: [] });
  assert.deepEqual(await lireCartoRoutesSceniquesGeojson(rpcAbsente), { type: 'FeatureCollection', features: [] });
  assert.deepEqual(await lireCartoSentiersGeojson(rpcAbsente), { type: 'FeatureCollection', features: [] });
});

test('couches GeoJSON circuits/bases (M410) : passe-plat FeatureCollection ; vue absente (42883) → FC vide', async () => {
  const { lireCartoCircuitsGeojson, lireCartoBasesGeojson } = await import('./carto.js');
  const fcC = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [[8, 60], [8.1, 60.1]] }, properties: { circuit_id: 3, nom: 'Besseggen' } }] };
  const fcB = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [8, 58] }, properties: { base_id: 1, nom: 'Kristiansand' } }] };
  assert.deepEqual(await lireCartoCircuitsGeojson(fakeRpc({ carto_circuits_geojson: fcC })), fcC as never);
  assert.deepEqual(await lireCartoBasesGeojson(fakeRpc({ carto_bases_geojson: fcB })), fcB as never);
  // Vues v_web_circuits / v_web_bases_ideales pas encore livrées (arrivent au dump final) → FC vide, jamais 500.
  assert.deepEqual(await lireCartoCircuitsGeojson(rpcAbsente), { type: 'FeatureCollection', features: [] });
  assert.deepEqual(await lireCartoBasesGeojson(rpcAbsente), { type: 'FeatureCollection', features: [] });
});
