// TDD (M097/M092) : appétit thématique par voyageur. Le morceau pur testable sans DB est la validation du corps
// d'écriture { theme, appetit∈[0,1] }. L'orchestration (whoami → capacité voter → RPC) est flip-ready (gatée DSN).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validerAppetit, ecrireAppetit } from './appetit.js';
import type { appelerRpc, ArgRpc } from '../db/rpc.js';
import { ErreurRequete } from '../http/erreurs.js';

test('validerAppetit accepte { theme non vide, appetit dans [0,1] }', () => {
  assert.deepEqual(validerAppetit({ theme: 'nautique', appetit: 0.9 }), { theme: 'nautique', appetit: 0.9 });
  assert.deepEqual(validerAppetit({ theme: 'faune', appetit: 0 }), { theme: 'faune', appetit: 0 });
  assert.deepEqual(validerAppetit({ theme: 'faune', appetit: 1 }), { theme: 'faune', appetit: 1 });
});

test('validerAppetit refuse thème manquant/vide, appetit hors [0,1] ou non numérique', () => {
  assert.throws(() => validerAppetit({ appetit: 0.5 }), ErreurRequete); // thème manquant
  assert.throws(() => validerAppetit({ theme: '  ', appetit: 0.5 }), ErreurRequete); // thème vide
  assert.throws(() => validerAppetit({ theme: 'x', appetit: 1.5 }), ErreurRequete); // > 1
  assert.throws(() => validerAppetit({ theme: 'x', appetit: -0.1 }), ErreurRequete); // < 0
  assert.throws(() => validerAppetit({ theme: 'x', appetit: 'beaucoup' }), ErreurRequete); // pas un nombre
  assert.throws(() => validerAppetit('non'), ErreurRequete); // pas un objet
});

test('ecrireAppetit envoie l’appétit en cast NUMERIC (pas double precision — sinon la RPC numeric ne résout pas, C060)', async () => {
  const appels: Array<{ fn: string; args: readonly ArgRpc[] }> = [];
  const rpc = (async (fn: string, args: readonly ArgRpc[] = []) => {
    appels.push({ fn, args });
    return fn === 'whoami' ? { membre_id: 2, prenom: 'M', role: 'mamie' } : { ok: true, theme: 'nautique', appetit: 0.8 };
  }) as typeof appelerRpc;
  await ecrireAppetit('CODE', { theme: 'nautique', appetit: 0.8 }, rpc);
  const ecrire = appels.find((a) => a.fn === 'appetit_ecrire');
  assert.ok(ecrire, 'appetit_ecrire doit être appelée');
  assert.equal(ecrire!.args[2]!.cast, 'numeric'); // 3e arg = appetit ; JAMAIS 'double precision'
});
