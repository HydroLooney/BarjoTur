// Tests des validateurs de vote (logique pure, sans DB). Couvre la grammaire tier-list réelle (T/S/A/B/C/D)
// et la forme des références (p:/c:/v:). L'orchestration RPC et le mapping d'erreurs relèvent de la recette d'API.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estTierValide, validerRef, validerTiers, validerDemandeEchangeVote } from './votes.js';
import { ErreurRequete } from '../http/erreurs.js';

test('estTierValide accepte les six tiers réels et rejette le reste', () => {
  for (const t of ['T', 'S', 'A', 'B', 'C', 'D']) {
    assert.equal(estTierValide(t), true, `tier ${t}`);
  }
  assert.equal(estTierValide('E'), false);
  assert.equal(estTierValide(''), false);
  assert.equal(estTierValide(1), false);
});

test('validerRef accepte p:/c:/v: et rejette les formes invalides', () => {
  assert.equal(validerRef('p:-123'), 'p:-123'); // osm_id peut être négatif
  assert.equal(validerRef('c:45'), 'c:45');
  assert.equal(validerRef('v:oslo-lofoten'), 'v:oslo-lofoten');
  assert.throws(() => validerRef('x:1'), ErreurRequete);
  assert.throws(() => validerRef('p:'), ErreurRequete);
  assert.throws(() => validerRef('123'), ErreurRequete);
  assert.throws(() => validerRef(42), ErreurRequete);
});

test('validerTiers accepte une carte propre, rejette clé ou tier invalide', () => {
  assert.deepEqual(validerTiers({ 'p:1': 'S', 'c:2': 'A' }), { 'p:1': 'S', 'c:2': 'A' });
  assert.deepEqual(validerTiers({}), {});
  assert.throws(() => validerTiers({ mauvaise: 'S' }), ErreurRequete);
  assert.throws(() => validerTiers({ 'p:1': 'Z' }), ErreurRequete);
  assert.throws(() => validerTiers(['p:1']), ErreurRequete);
  assert.throws(() => validerTiers(null), ErreurRequete);
});

test('validerDemandeEchangeVote : retirer/poser réfs + tier valide (M392)', () => {
  assert.deepEqual(validerDemandeEchangeVote({ retirer: 'p:10', poser: 'p:12', tier: 'T' }), { retirer: 'p:10', poser: 'p:12', tier: 'T' });
  assert.throws(() => validerDemandeEchangeVote({ retirer: 'x', poser: 'p:12', tier: 'T' }), ErreurRequete);
  assert.throws(() => validerDemandeEchangeVote({ retirer: 'p:10', poser: 'p:12', tier: 'E' }), ErreurRequete);
});

test('echangerVote : passe-plat atomique → VoteUnitaireResult (ok+budget+recos)', async () => {
  const { echangerVote } = await import('./votes.js');
  const attendu = { ok: true, budget: { T: 2 }, recos: [] };
  const fakeRpc = (async () => attendu) as never;
  const res = await echangerVote('CODE', { retirer: 'p:10', poser: 'p:12', tier: 'T' }, fakeRpc);
  assert.deepEqual(res, attendu);
});

test('validerDemandePoserHorsBudget : { poser, tier } réf + tier valide (M396)', async () => {
  const { validerDemandePoserHorsBudget } = await import('./votes.js');
  assert.deepEqual(validerDemandePoserHorsBudget({ poser: 'p:12', tier: 'T' }), { poser: 'p:12', tier: 'T' });
  assert.throws(() => validerDemandePoserHorsBudget({ poser: 'x', tier: 'T' }), ErreurRequete);
  assert.throws(() => validerDemandePoserHorsBudget({ poser: 'p:12', tier: 'E' }), ErreurRequete);
});

test('lirePaniers : passe-plat → EtatPaniers ; RPC absente → paniers vides (R1, non compté)', async () => {
  const { lirePaniers } = await import('./votes.js');
  const attendu = { paniers: [{ tier: 'T', quota: 2, dans_budget: [], hors_budget: [], a_reequilibrer: false }], budget_a_resoudre: false };
  const okRpc = (async () => attendu) as never;
  assert.deepEqual(await lirePaniers('CODE', okRpc), attendu);
  // Avant le flip (RPC pas encore posée en DB2) : dégradation propre, pas de 500, panier vide.
  const absente = (async () => { throw { code: '42883' }; }) as never;
  assert.deepEqual(await lirePaniers('CODE', absente), { paniers: [], budget_a_resoudre: false });
});

test('poserHorsBudget : passe-plat voie (b) → VoteUnitaireResult + EtatPaniers', async () => {
  const { poserHorsBudget } = await import('./votes.js');
  const attendu = { ok: true, action: 'set', paniers: { paniers: [], budget_a_resoudre: true } };
  const okRpc = (async () => attendu) as never;
  assert.deepEqual(await poserHorsBudget('CODE', { poser: 'p:12', tier: 'T' }, okRpc), attendu);
});

test('lireCascade : passe-plat voie (a) → EtapeCascade[] ; RPC absente → []', async () => {
  const { lireCascade } = await import('./votes.js');
  const etapes = [{ tier: 'T', vers: 'S', candidats: [{ ref: 'p:1', osm_id: '1', nom: 'X' }] }];
  const okRpc = (async () => etapes) as never;
  assert.deepEqual(await lireCascade('CODE', 'T', okRpc), etapes);
  const absente = (async () => { throw { code: '42883' }; }) as never;
  assert.deepEqual(await lireCascade('CODE', 'T', absente), []);
});
