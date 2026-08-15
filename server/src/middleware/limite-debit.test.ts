// Durcissement PROD (M280 §2) : limiteur de débit en mémoire, sans dépendance. Fenêtre fixe par IP. Horloge injectable
// pour tester le reset de fenêtre de façon déterministe. Cercle familial → plafond généreux, juste un garde-fou anti-abus.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response } from 'express';
import { creerLimiteDebit } from './limite-debit.js';

function fakeReqRes(ip: string) {
  const cap: { statut: number; corps: unknown; headers: Record<string, string> } = { statut: 0, corps: undefined, headers: {} };
  const req = { ip } as unknown as Request;
  const res = {
    status(s: number) {
      cap.statut = s;
      return res;
    },
    json(b: unknown) {
      cap.corps = b;
      return res;
    },
    setHeader(k: string, v: string | number) {
      cap.headers[k] = String(v);
      return res;
    },
  } as unknown as Response;
  return { req, res, cap };
}

test('sous le plafond : next appelé, pas de 429', () => {
  const horloge = 1000;
  const mw = creerLimiteDebit({ fenetreMs: 1000, max: 3, maintenant: () => horloge });
  for (let i = 0; i < 3; i++) {
    const { req, res, cap } = fakeReqRes('1.1.1.1');
    let suivant = false;
    mw(req, res, () => {
      suivant = true;
    });
    assert.equal(suivant, true, `requête ${i + 1} devrait passer`);
    assert.equal(cap.statut, 0);
  }
});

test('au-delà du plafond : 429 enveloppé, next NON appelé, Retry-After posé', () => {
  const horloge = 1000;
  const mw = creerLimiteDebit({ fenetreMs: 1000, max: 2, maintenant: () => horloge });
  const passer = () => {
    const { req, res, cap } = fakeReqRes('2.2.2.2');
    let suivant = false;
    mw(req, res, () => {
      suivant = true;
    });
    return { suivant, cap };
  };
  passer();
  passer();
  const r = passer(); // 3e > max 2
  assert.equal(r.suivant, false);
  assert.equal(r.cap.statut, 429);
  assert.deepEqual(r.cap.corps, { ok: false, erreur: { code: 'trop_de_requetes', message: 'Trop de requêtes, réessayez plus tard.' } });
  assert.ok(r.cap.headers['Retry-After']);
});

test('reset de fenêtre : le compteur repart après fenetreMs', () => {
  let horloge = 1000;
  const mw = creerLimiteDebit({ fenetreMs: 1000, max: 1, maintenant: () => horloge });
  const passer = (ip: string) => {
    const { req, res, cap } = fakeReqRes(ip);
    let suivant = false;
    mw(req, res, () => {
      suivant = true;
    });
    return { suivant, cap };
  };
  assert.equal(passer('3.3.3.3').suivant, true); // 1re ok
  assert.equal(passer('3.3.3.3').cap.statut, 429); // 2e bloquée
  horloge += 1001; // fenêtre écoulée
  assert.equal(passer('3.3.3.3').suivant, true); // repart
});

test('IP distinctes = compteurs indépendants', () => {
  const horloge = 1000;
  const mw = creerLimiteDebit({ fenetreMs: 1000, max: 1, maintenant: () => horloge });
  const passer = (ip: string) => {
    const { req, res } = fakeReqRes(ip);
    let suivant = false;
    mw(req, res, () => {
      suivant = true;
    });
    return suivant;
  };
  assert.equal(passer('4.4.4.4'), true);
  assert.equal(passer('5.5.5.5'), true); // autre IP, pas affectée
});

test('compteSi : les lectures (GET) ne pèsent pas sur le plafond des écritures', () => {
  const horloge = 1000;
  const mw = creerLimiteDebit({
    fenetreMs: 1000,
    max: 1,
    maintenant: () => horloge,
    compteSi: (m) => m !== 'GET' && m !== 'HEAD',
  });
  const passer = (methode: string) => {
    const cap: { statut: number } = { statut: 0 };
    const req = { ip: '9.9.9.9', method: methode } as unknown as Request;
    const res = {
      status(s: number) {
        cap.statut = s;
        return res;
      },
      json() {
        return res;
      },
      setHeader() {
        return res;
      },
    } as unknown as Response;
    let suivant = false;
    mw(req, res, () => {
      suivant = true;
    });
    return { suivant, cap };
  };
  // 10 GET : jamais comptés, toujours next
  for (let i = 0; i < 10; i++) assert.equal(passer('GET').suivant, true);
  // 1er POST : ok ; 2e POST : bloqué (max 1 mutation/fenêtre)
  assert.equal(passer('POST').suivant, true);
  assert.equal(passer('POST').cap.statut, 429);
});
