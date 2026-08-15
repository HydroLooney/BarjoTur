// TDD (M173 §2, T045) : passe-plat des variantes d'une liaison base→base. C ouvre une liaison → il voit le FRONT de
// Pareto temps↔€ (les choix rationnels) + la variante par défaut. Sélection = arbitrage shared. Génération = A (corridor).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assemblerVariantes, lireVariantesLiaison } from './liaison.js';
import type { appelerRpc } from '../db/rpc.js';
import type { VarianteLiaison } from '../domain/arbitrage.js';

function v(mode: VarianteLiaison['mode'], temps_min: number, km: number, ferry = 0, peage = 0): VarianteLiaison {
  return { mode, temps_min, km, cout: { carburant_eur: 0, ferry_eur: ferry, peage_eur: peage } };
}

test('assemblerVariantes rend le front de Pareto + la variante défaut', () => {
  const ferry = v('defaut', 60, 40, 30, 0); // 60 min, 30 €
  const route = v('sans_ferry', 130, 90, 0, 0); // 130 min, 0 €
  const out = assemblerVariantes([ferry, route]);
  assert.equal(out.front.length, 2); // incomparables → les deux au front
  assert.equal(out.defaut?.mode, 'defaut');
});

test('assemblerVariantes : liste vide → front vide, défaut null', () => {
  assert.deepEqual(assemblerVariantes([]), { front: [], defaut: null });
});

test('lireVariantesLiaison : dégradation propre si RPC absente (42883) → 200 vide', async () => {
  const rpcAbsente = (async () => {
    const e = new Error('function api.variante_liaison(...) does not exist') as Error & { code?: string };
    e.code = '42883';
    throw e;
  }) as typeof appelerRpc;
  assert.deepEqual(await lireVariantesLiaison(16, 36, rpcAbsente), { front: [], defaut: null });
});
