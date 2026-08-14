// Service identité : résout « qui je suis » depuis le lien perso (api.whoami). Non gaté PIN (A03).
// Ne connaît pas Express. 404 si le lien est inconnu ou inactif.

import { appelerRpc, argTexte } from '../db/rpc.js';
import { Erreurs, exigerPresent } from '../http/erreurs.js';
import { normaliserRole, qualifierDepuisRole } from '../domain/identite.js';
import type { Whoami } from '../domain/identite.js';

/** Résout l'identité et NORMALISE le rôle physique DB2 vers le vocabulaire d'accès du contrat (M052) : whoami est la
 *  source de vérité unique du rôle d'accès ; les consommateurs (garde organisateur, gating UI) n'ont plus à mapper. */
export async function lireWhoami(code: string, rpc = appelerRpc): Promise<Whoami> {
  const res = await rpc<Whoami | null>('whoami', [argTexte(code)]);
  const who = exigerPresent(res, Erreurs.codeInconnu);
  // La qualification se DÉRIVE du rôle PHYSIQUE (who.role brut, avant normalisation) : pas de colonne dédiée (M082).
  return { ...who, qualification: qualifierDepuisRole(who.role), role: normaliserRole(who.role) };
}
