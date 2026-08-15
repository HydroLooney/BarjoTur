// TDD (M361/M363) : passe-plats réglages + garde de capacité AVANT le RPC (autorité serveur). RPC injectée (fixtures).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lireReglages, ecrireReglage } from './reglage.js';
import { appelerRpc } from '../db/rpc.js';
import { ErreurRequete } from '../http/erreurs.js';

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

test('lireReglages : passe-plat + dégradation (RPC absente → [])', async () => {
  const rg = [{ famille: 'composition', cle: 'ravitaillement_intervalle_j', valeur: 4, valeur_defaut: 4 }];
  assert.deepEqual(await lireReglages('composition', fakeRpc({ reglages_lire: rg })), rg as never);
  assert.deepEqual(await lireReglages('composition', rpcAbsente), []);
});

test('ecrireReglage : capacité refusée AVANT le RPC (un voyageur ne règle pas la composition)', async () => {
  let appele = false;
  const rpc = (async () => {
    appele = true;
    return { ok: true };
  }) as Rpc;
  await assert.rejects(
    () => ecrireReglage('composition', { role: 'voyageur' }, 'CODE', { cle: 'c', valeur: 1, pin: '1234' }, rpc),
    ErreurRequete,
  );
  assert.equal(appele, false); // pas d'appel RPC si non habilité
});

test('ecrireReglage : organisateur habilité → RPC appelé, ok', async () => {
  const res = await ecrireReglage(
    'composition',
    { role: 'organisateur' },
    'CODE',
    { cle: 'ravitaillement_intervalle_j', valeur: 5, pin: '1234' },
    fakeRpc({ reglage_ecrire: { ok: true } }),
  );
  assert.deepEqual(res, { ok: true });
});

test('ecrireReglage : refus métier RPC (pin) → 403', async () => {
  await assert.rejects(
    () =>
      ecrireReglage('composition', { role: 'organisateur' }, 'CODE', { cle: 'c', valeur: 1, pin: 'x' },
        fakeRpc({ reglage_ecrire: { ok: false, error: 'pin invalide' } })),
    ErreurRequete,
  );
});
