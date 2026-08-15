// TDD (M420) : lireWhoami résout l'identité = rôle CANONIQUE (via shared normaliserRoleBrut) + qualification + conducteur
// (colonne membre.conducteur, whoami/019). Passe-plat testé avec RPC injecté (le mapping raw→canonique est couvert par
// domain/identite.test.ts). 404 si lien inconnu.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lireWhoami } from './identite.js';
import { appelerRpc } from '../db/rpc.js';
import { ErreurRequete } from '../http/erreurs.js';

type Rpc = typeof appelerRpc;
const rpcRend = (v: unknown): Rpc => ((async () => v) as unknown) as Rpc;

test('lireWhoami : owner brut → rôle canonique organisateur_principal/adulte + conducteur', async () => {
  const who = await lireWhoami('CODE', rpcRend({ membre_id: 1, prenom: 'G', role: 'owner', conducteur: true }));
  assert.equal(who.role, 'organisateur_principal');
  assert.equal(who.qualification, 'adulte');
  assert.equal(who.conducteur, true);
});

test('lireWhoami : enfant brut → voyageur/enfant, conducteur absent → false', async () => {
  const who = await lireWhoami('CODE', rpcRend({ membre_id: 3, prenom: 'K', role: 'enfant' }));
  assert.equal(who.role, 'voyageur');
  assert.equal(who.qualification, 'enfant');
  assert.equal(who.conducteur, false); // pas de colonne renvoyée → défaut prudent false
});

test('lireWhoami : lien inconnu → 400/erreur (codeInconnu)', async () => {
  await assert.rejects(() => lireWhoami('X', rpcRend(null)), ErreurRequete);
});
