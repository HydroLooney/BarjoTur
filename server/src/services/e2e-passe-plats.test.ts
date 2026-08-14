// Durcissement BFF (M102 §3, M104) : e2e des passe-plats voyageurs / budget-temps / appétit sur FIXTURES, via la
// fonction RPC injectée (défaut `appelerRpc`). On vérifie l'orchestration complète : whoami NORMALISE le rôle →
// `peut()` fait AUTORITÉ sur chaque mutation → un `ok:false` de RPC devient une ErreurRequete 4xx (JAMAIS un 500).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lireVoyageurs, changerRole } from './voyageurs.js';
import { ecrireAppetit, lireAppetits } from './appetit.js';
import { lireBudgetTempsPoi } from './activite.js';
import { appelerRpc } from '../db/rpc.js';
import { ErreurRequete } from '../http/erreurs.js';

type Rpc = typeof appelerRpc;
/** Construit un faux RPC qui répond par nom de fonction (les valeurs sont les retours jsonb simulés de DB2). */
function fakeRpc(reponses: Record<string, unknown>): Rpc {
  return (async (fn: string) => {
    if (!(fn in reponses)) throw new Error(`RPC inattendue dans le test : ${fn}`);
    return reponses[fn];
  }) as Rpc;
}
const estStatut = (s: number) => (e: unknown) => e instanceof ErreurRequete && e.statut === s;

test('lireVoyageurs : organisateur autorisé, non-organisateur refusé (403), avant tout accès data', async () => {
  const brut = { membre_id: 2, prenom: 'Mamie', role: 'mamie', code_lien: 'x', actif: true };
  const voyageurs = await lireVoyageurs(1, 'CODE', fakeRpc({ whoami: { membre_id: 1, prenom: 'G', role: 'owner' }, voyageurs_lire: [brut] }));
  assert.equal(voyageurs.length, 1);
  assert.equal(voyageurs[0]!.role, 'voyageur'); // rôle physique 'mamie' NORMALISÉ
  assert.equal(voyageurs[0]!.qualification, 'adulte');
  await assert.rejects(
    () => lireVoyageurs(1, 'CODE', fakeRpc({ whoami: { membre_id: 3, prenom: 'Enfant', role: 'enfant' } })),
    estStatut(403), // 'enfant'→'voyageur' n'a pas administrer_voyageurs
  );
});

test('changerRole : succès organisateur, et un ok:false RPC (pin) devient 403 — jamais un 500', async () => {
  const ok = await changerRole(1, 'CODE', { membre_id: 2, role: 'voyageur', pin: '1234' },
    fakeRpc({ whoami: { membre_id: 1, prenom: 'G', role: 'owner' }, voyageur_role_changer: { ok: true, membre: { membre_id: 2, prenom: 'M', role: 'voyageur', code_lien: 'y', actif: true } } }));
  assert.equal(ok.role, 'voyageur');
  await assert.rejects(
    () => changerRole(1, 'CODE', { membre_id: 2, role: 'voyageur', pin: 'faux' },
      fakeRpc({ whoami: { membre_id: 1, prenom: 'G', role: 'owner' }, voyageur_role_changer: { ok: false, error: 'pin invalide' } })),
    estStatut(403), // refusRpc mappe pin/rôle → 403, PAS 500
  );
});

test('lireWhoami inconnu → 404 propre (lien inactif), pas de 500', async () => {
  await assert.rejects(
    () => lireVoyageurs(1, 'INCONNU', fakeRpc({ whoami: null })),
    estStatut(404),
  );
});

test('ecrireAppetit : capacité voter requise ; invité refusé (403), voyageur OK ; ok:false → 400 propre', async () => {
  const ok = await ecrireAppetit('CODE', { theme: 'nautique', appetit: 0.9 },
    fakeRpc({ whoami: { membre_id: 2, prenom: 'M', role: 'mamie' }, appetit_ecrire: { ok: true, theme: 'nautique', appetit: 0.9 } }));
  assert.deepEqual(ok, { theme: 'nautique', appetit: 0.9 });
  await assert.rejects(
    () => ecrireAppetit('CODE', { theme: 'x', appetit: 0.5 }, fakeRpc({ whoami: { membre_id: 9, prenom: 'I', role: 'invite' } })),
    estStatut(403), // invité n'a pas la capacité voter
  );
  await assert.rejects(
    () => ecrireAppetit('CODE', { theme: 'x', appetit: 0.5 },
      fakeRpc({ whoami: { membre_id: 2, prenom: 'M', role: 'mamie' }, appetit_ecrire: { ok: false, error: 'membre inconnu' } })),
    estStatut(400), // appetit_refuse, pas 500
  );
});

test('passe-plats de lecture : budget-temps et appétits rendent le jsonb tel quel / défaut vide', async () => {
  const bt = await lireBudgetTempsPoi(141, fakeRpc({ budget_temps_poi: { visite: { defaut_min: 90 }, themes: ['musee'] } }));
  assert.deepEqual(bt, { visite: { defaut_min: 90 }, themes: ['musee'] });
  assert.equal(await lireBudgetTempsPoi(999, fakeRpc({ budget_temps_poi: null })), null); // POI sans budget
  assert.deepEqual(await lireAppetits('CODE', fakeRpc({ appetit_lire: null })), []); // aucun appétit → []
});
