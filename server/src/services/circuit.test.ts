// TDD (M107/A23) : passe-plats circuits + zones-activités. Parties PURES testables sans DB : validation de l'id et des
// filtres (zone/durée/mode) ; et e2e des lectures via le RPC injecté (fixtures). Données réelles = A (flip, DSN).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCircuitId, validerFiltresCircuit, lireCircuits, lireCircuit, lireZonesActivites } from './circuit.js';
import { appelerRpc } from '../db/rpc.js';
import { ErreurRequete } from '../http/erreurs.js';

type Rpc = typeof appelerRpc;
const fakeRpc = (reponses: Record<string, unknown>): Rpc =>
  (async (fn: string) => {
    if (!(fn in reponses)) throw new Error(`RPC inattendue : ${fn}`);
    return reponses[fn];
  }) as Rpc;

test('parseCircuitId : entier positif, sinon 400', () => {
  assert.equal(parseCircuitId('12'), 12);
  assert.throws(() => parseCircuitId('0'), ErreurRequete);
  assert.throws(() => parseCircuitId('abc'), ErreurRequete);
});

test('validerFiltresCircuit : durée/mode contraints à l’énumération, zone libre, tout optionnel', () => {
  assert.deepEqual(validerFiltresCircuit({}), {});
  assert.deepEqual(validerFiltresCircuit({ zone: 'Lofoten', duree: 'jours', mode: 'van' }), {
    zone: 'Lofoten',
    duree: 'jours',
    mode: 'van',
  });
  assert.throws(() => validerFiltresCircuit({ duree: 'bogus' }), ErreurRequete);
  assert.throws(() => validerFiltresCircuit({ mode: 'avion' }), ErreurRequete);
  assert.deepEqual(validerFiltresCircuit({ zone: ['x', 'y'] }), {}); // non-string ignoré (query malformée)
});

test('lireCircuits / lireCircuit / lireZonesActivites : passe-plats rendant le jsonb (défaut vide / null)', async () => {
  const circuit = { nom: 'Boucle des Lofoten', source: { guide: 'X' }, mode_origine: 'voiture', duree: 'jours', etapes: [] };
  assert.deepEqual(await lireCircuits({}, fakeRpc({ circuits_lire: [circuit] })), [circuit]);
  assert.deepEqual(await lireCircuits({}, fakeRpc({ circuits_lire: null })), []); // aucun → []
  assert.deepEqual(await lireCircuit(3, fakeRpc({ circuit_lire: circuit })), circuit);
  assert.equal(await lireCircuit(999, fakeRpc({ circuit_lire: null })), null); // absent → null
  assert.deepEqual(await lireZonesActivites('Lofoten', fakeRpc({ zones_activites_lire: null })), []);
});

test('dégradation propre : RPC absente (42883, tables d’A pas encore posées) → 200 vide, PAS de 500', async () => {
  const rpcAbsente = (async () => {
    const e = new Error('function api.circuits_lire(...) does not exist') as Error & { code?: string };
    e.code = '42883'; // undefined_function
    throw e;
  }) as typeof appelerRpc;
  assert.deepEqual(await lireCircuits({}, rpcAbsente), []);
  assert.equal(await lireCircuit(1, rpcAbsente), null);
  assert.deepEqual(await lireZonesActivites(undefined, rpcAbsente), []);
});

test('dégradation ciblée : une AUTRE erreur SQL remonte (pas masquée)', async () => {
  const rpcAutre = (async () => {
    const e = new Error('relation does not exist') as Error & { code?: string };
    e.code = '42P01'; // undefined_table — vrai problème, doit remonter
    throw e;
  }) as typeof appelerRpc;
  await assert.rejects(() => lireCircuits({}, rpcAutre));
});
