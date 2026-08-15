// Durcissement PROD (M280 §2) : en-têtes de sécurité HTTP, sans dépendance (helmet-lite). L'app est une API JSON servie
// derrière un lien perso ; on pose les en-têtes défensifs standard. La CSP relève du client statique (servi ailleurs),
// pas de cette API.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response } from 'express';
import { entetesSecurite } from './securite.js';

function fakeRes() {
  const headers: Record<string, string> = {};
  const res = {
    setHeader(k: string, v: string | number) {
      headers[k] = String(v);
      return res;
    },
  } as unknown as Response;
  return { res, headers };
}

test('entetesSecurite pose les en-têtes défensifs et appelle next', () => {
  const { res, headers } = fakeRes();
  let suivant = false;
  entetesSecurite({} as Request, res, () => {
    suivant = true;
  });
  assert.equal(suivant, true);
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['X-Frame-Options'], 'DENY');
  assert.equal(headers['Referrer-Policy'], 'no-referrer');
  assert.equal(headers['Cross-Origin-Resource-Policy'], 'same-site');
  assert.equal(headers['X-DNS-Prefetch-Control'], 'off');
  assert.match(headers['Strict-Transport-Security'] ?? '', /max-age=\d+/);
});
