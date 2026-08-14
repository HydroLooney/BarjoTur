// TDD (T039, M074) : admin des voyageurs. Surface PURE testable sans DB — mapping membre→Voyageur, garde organisateur,
// validation des demandes (changer rôle / régénérer lien). L'orchestration DB2 (whoami + RPC) est flip-ready (au DSN).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { versVoyageur, estRoleAttribuable, type MembreBrut } from '../domain/voyageurs.js';
import { validerDemandeRole, validerDemandeRegenererLien, exigerCapacite } from './voyageurs.js';
import { ErreurRequete } from '../http/erreurs.js';

const brut = (o: Partial<MembreBrut> = {}): MembreBrut => ({
  membre_id: 7,
  prenom: 'Mamie',
  role: 'mamie',
  code_lien: 'aZ9_kQ2xLmp',
  actif: true,
  ...o,
});

test('versVoyageur mappe le membre brut et NORMALISE le rôle physique (M052)', () => {
  assert.deepEqual(versVoyageur(brut({ role: 'owner', prenom: 'Guillaume' })), {
    id: 7,
    prenom: 'Guillaume',
    role: 'organisateur_principal',
    qualification: null,
    codeLien: 'aZ9_kQ2xLmp',
    actif: true,
  });
  assert.equal(versVoyageur(brut({ role: 'mamie' })).role, 'voyageur');
  assert.equal(versVoyageur(brut({ role: 'enfant' })).role, 'voyageur');
});

test('estRoleAttribuable autorise organisateur/voyageur/demo/invite, PAS organisateur_principal (unique) ni inconnu', () => {
  assert.equal(estRoleAttribuable('organisateur'), true);
  assert.equal(estRoleAttribuable('voyageur'), true);
  assert.equal(estRoleAttribuable('demo'), true);
  assert.equal(estRoleAttribuable('invite'), true);
  assert.equal(estRoleAttribuable('organisateur_principal'), false);
  assert.equal(estRoleAttribuable('n_importe_quoi'), false);
});

test('exigerCapacite(administrer_voyageurs) passe pour un organisateur, refuse (403) sinon', () => {
  assert.equal(exigerCapacite('organisateur_principal', 'administrer_voyageurs'), undefined);
  assert.equal(exigerCapacite('organisateur', 'administrer_voyageurs'), undefined);
  for (const r of ['voyageur', 'demo', 'invite', 'inconnu']) {
    assert.throws(
      () => exigerCapacite(r, 'administrer_voyageurs'),
      (e: unknown) => e instanceof ErreurRequete && e.statut === 403,
    );
  }
});

test('validerDemandeRole exige membre_id entier positif + rôle attribuable + pin (corps partagé, sans code)', () => {
  const ok = validerDemandeRole({ membre_id: 3, role: 'voyageur', pin: '1234' });
  assert.deepEqual(ok, { membre_id: 3, role: 'voyageur', pin: '1234' });
  assert.throws(() => validerDemandeRole({ role: 'voyageur', pin: '1234' }), ErreurRequete); // membre_id manquant
  assert.throws(() => validerDemandeRole({ membre_id: 0, role: 'voyageur', pin: '1' }), ErreurRequete); // id ≤ 0
  assert.throws(() => validerDemandeRole({ membre_id: 3, role: 'demo', pin: '' }), ErreurRequete); // pin vide
  assert.throws(() => validerDemandeRole({ membre_id: 3, role: 'organisateur_principal', pin: '1' }), ErreurRequete); // principal non attribuable
});

test('validerDemandeRegenererLien exige membre_id + pin (corps partagé, sans code ni rôle)', () => {
  assert.deepEqual(validerDemandeRegenererLien({ membre_id: 5, pin: '4321' }), { membre_id: 5, pin: '4321' });
  assert.throws(() => validerDemandeRegenererLien({ pin: '4321' }), ErreurRequete); // membre_id manquant
  assert.throws(() => validerDemandeRegenererLien({ membre_id: 5 }), ErreurRequete); // pin manquant
});
