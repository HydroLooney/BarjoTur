// Service identité : résout « qui je suis » depuis le lien perso (api.whoami). Non gaté PIN (A03).
// Ne connaît pas Express. 404 si le lien est inconnu ou inactif.

import { appelerRpc, argTexte } from '../db/rpc.js';
import { Erreurs, exigerPresent } from '../http/erreurs.js';
import { normaliserRole, qualifierDepuisRole } from '../domain/identite.js';
import type { WhoamiBrut, Whoami } from '../domain/identite.js';

/** Résout l'identité et NORMALISE le rôle physique DB2 vers le rôle d'accès canonique via la source unique shared
 *  `normaliserRoleBrut` (M420). whoami est le POINT UNIQUE : les consommateurs (garde organisateur, gating UI) reçoivent
 *  le rôle canonique + la qualification + `conducteur` (colonne membre.conducteur, 019) → `peut()` ne voit jamais de rôle brut. */
export async function lireWhoami(code: string, rpc = appelerRpc): Promise<Whoami> {
  const res = await rpc<WhoamiBrut | null>('whoami', [argTexte(code)]);
  const who = exigerPresent(res, Erreurs.codeInconnu);
  return {
    membre_id: who.membre_id,
    prenom: who.prenom,
    role: normaliserRole(who.role),
    qualification: qualifierDepuisRole(who.role),
    conducteur: who.conducteur ?? false,
  };
}
