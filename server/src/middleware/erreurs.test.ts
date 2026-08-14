// Durcissement BFF (M102 §3) : le middleware d'erreurs garantit qu'une erreur MÉTIER (ErreurRequete, ce que lèvent les
// services sur un refus / un ok:false de RPC) sort avec SON statut 4xx — JAMAIS un 500 — et dans l'enveloppe ApiErreur ;
// seule une exception non gérée devient un 500 sobre (sans fuite de détail technique).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response } from 'express';
import { middlewareErreurs } from './erreurs.js';
import { ErreurRequete } from '../http/erreurs.js';

function fakeRes() {
  const cap: { statut: number; corps: unknown } = { statut: 0, corps: undefined };
  const res = {
    status(s: number) {
      cap.statut = s;
      return res;
    },
    json(b: unknown) {
      cap.corps = b;
      return res;
    },
  } as unknown as Response;
  return { res, cap };
}

const appliquer = (err: unknown) => {
  const { res, cap } = fakeRes();
  middlewareErreurs(err, {} as Request, res, () => {});
  return cap;
};

test('une erreur métier (ErreurRequete) sort avec SON statut 4xx, jamais 500', () => {
  for (const [statut, code] of [
    [403, 'role_insuffisant'],
    [400, 'requete_invalide'],
    [404, 'code_inconnu'],
    [400, 'appetit_refuse'],
  ] as const) {
    const cap = appliquer(new ErreurRequete(statut, code, 'message métier'));
    assert.equal(cap.statut, statut);
    assert.deepEqual(cap.corps, { ok: false, erreur: { code, message: 'message métier' } });
  }
});

test('une exception non gérée devient un 500 SOBRE (pas de fuite du détail technique)', () => {
  const silence = console.error;
  console.error = () => {}; // le middleware journalise le détail serveur ; on n'en pollue pas la sortie de test
  try {
    const cap = appliquer(new Error('détail interne fuitant: DSN=postgres://secret'));
    assert.equal(cap.statut, 500);
    assert.deepEqual(cap.corps, { ok: false, erreur: { code: 'erreur_interne', message: 'Une erreur interne est survenue.' } });
    assert.doesNotMatch(JSON.stringify(cap.corps), /secret|DSN/); // aucune fuite
  } finally {
    console.error = silence;
  }
});
