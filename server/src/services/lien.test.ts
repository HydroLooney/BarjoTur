// TDD (A34/M173/M176) : génération + révocation de liens d'invitation par portée. Validation pure + e2e de l'autorité
// (organisateur + peut) et de la dégradation métier (ok:false → 4xx, jamais 500) via le RPC injecté.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validerDemandeGenererLien, validerDemandeRevoquerLien, genererLien, revoquerLien } from './lien.js';
import { appelerRpc } from '../db/rpc.js';
import { ErreurRequete } from '../http/erreurs.js';

const fakeRpc = (rep: Record<string, unknown>): typeof appelerRpc =>
  (async (fn: string) => {
    if (!(fn in rep)) throw new Error(`RPC inattendue : ${fn}`);
    return rep[fn];
  }) as typeof appelerRpc;
const estStatut = (s: number) => (e: unknown) => e instanceof ErreurRequete && e.statut === s;

test('validerDemandeGenererLien : portée contrainte à l’énumération + pin requis ; prénom/espaces optionnels', () => {
  assert.deepEqual(validerDemandeGenererLien({ portee: 'vitrine', pin: '1234' }), { portee: 'vitrine', pin: '1234' });
  const avec = validerDemandeGenererLien({ portee: 'membre', prenom: 'Alice', espacesVisibles: ['carte'], pin: '1' });
  assert.equal(avec.prenom, 'Alice');
  assert.throws(() => validerDemandeGenererLien({ portee: 'bogus', pin: '1' }), ErreurRequete);
  assert.throws(() => validerDemandeGenererLien({ portee: 'membre' }), ErreurRequete); // pin manquant
});

test('validerDemandeRevoquerLien : code cible + pin requis', () => {
  assert.deepEqual(validerDemandeRevoquerLien({ code: 'abc', pin: '1' }), { code: 'abc', pin: '1' });
  assert.throws(() => validerDemandeRevoquerLien({ pin: '1' }), ErreurRequete);
  assert.throws(() => validerDemandeRevoquerLien({ code: 'abc' }), ErreurRequete);
});

test('genererLien : organisateur autorisé rend le lien ; non-organisateur refusé (403) ; ok:false RPC → 403 (pas 500)', async () => {
  const membre = { membre_id: 9, prenom: 'Alice', role: 'invite', code_lien: 'newcode', actif: true };
  const ok = await genererLien(1, 'ORG', { portee: 'vitrine', pin: '1' },
    fakeRpc({ whoami: { membre_id: 1, prenom: 'G', role: 'owner' }, voyageur_lien_generer: { ok: true, membre } }));
  assert.equal(ok.voyageur.role, 'invite');
  await assert.rejects(
    () => genererLien(1, 'X', { portee: 'vitrine', pin: '1' }, fakeRpc({ whoami: { membre_id: 3, prenom: 'E', role: 'enfant' } })),
    estStatut(403),
  );
  await assert.rejects(
    () => genererLien(1, 'ORG', { portee: 'vitrine', pin: 'faux' },
      fakeRpc({ whoami: { membre_id: 1, prenom: 'G', role: 'owner' }, voyageur_lien_generer: { ok: false, error: 'pin invalide' } })),
    estStatut(403),
  );
});

test('genererLien : contrat COMPLET (T057) — { voyageur(code+rôle), portee, votesComptent, espacesVisibles effectifs }', async () => {
  const whoami = { membre_id: 1, prenom: 'G', role: 'owner' };
  // suggestion → rôle demo, votes NON comptés, espaces par défaut (explorer + notre_voyage).
  const sug = await genererLien(1, 'ORG', { portee: 'suggestion', pin: '1' },
    fakeRpc({ whoami, voyageur_lien_generer: { ok: true, membre: { membre_id: 9, prenom: 'Bob', role: 'demo', code_lien: 'sugcode', actif: true } } }));
  assert.equal(sug.voyageur.codeLien, 'sugcode');
  assert.equal(sug.voyageur.role, 'demo');
  assert.equal(sug.portee, 'suggestion');
  assert.equal(sug.votesComptent, false);
  assert.deepEqual(sug.espacesVisibles, ['explorer', 'notre_voyage']);

  // membre → rôle voyageur, votes COMPTENT, espaces = selon le rôle (pas de restriction → espacesVisibles absent).
  const mem = await genererLien(1, 'ORG', { portee: 'membre', prenom: 'Alice', pin: '1' },
    fakeRpc({ whoami, voyageur_lien_generer: { ok: true, membre: { membre_id: 10, prenom: 'Alice', role: 'voyageur', code_lien: 'memcode', actif: true } } }));
  assert.equal(mem.portee, 'membre');
  assert.equal(mem.votesComptent, true);
  assert.equal(mem.espacesVisibles, undefined);

  // override explicite d'espaces → la réponse reflète l'effectif demandé (autorité serveur = ce qui est stocké).
  const vit = await genererLien(1, 'ORG', { portee: 'vitrine', espacesVisibles: ['carte', 'le_voyage'], pin: '1' },
    fakeRpc({ whoami, voyageur_lien_generer: { ok: true, membre: { membre_id: 11, prenom: 'V', role: 'invite', code_lien: 'vitcode', actif: true } } }));
  assert.equal(vit.portee, 'vitrine');
  assert.equal(vit.votesComptent, false);
  assert.deepEqual(vit.espacesVisibles, ['carte', 'le_voyage']);
});

test('revoquerLien : organisateur OK ; lien inconnu → 400 propre (pas 500)', async () => {
  const ok = await revoquerLien(1, 'ORG', { code: 'cible', pin: '1' },
    fakeRpc({ whoami: { membre_id: 1, prenom: 'G', role: 'owner' }, voyageur_lien_revoquer: { ok: true } }));
  assert.equal(ok.ok, true);
  await assert.rejects(
    () => revoquerLien(1, 'ORG', { code: 'x', pin: '1' },
      fakeRpc({ whoami: { membre_id: 1, prenom: 'G', role: 'owner' }, voyageur_lien_revoquer: { ok: false, error: 'lien inconnu ou déjà révoqué' } })),
    estStatut(400),
  );
});
