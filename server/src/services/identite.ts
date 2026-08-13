// Service identité : résout « qui je suis » depuis le lien perso (api.whoami). Non gaté PIN (A03).
// Ne connaît pas Express. 404 si le lien est inconnu ou inactif.

import { appelerRpc, argTexte } from '../db/rpc.js';
import { Erreurs, exigerPresent } from '../http/erreurs.js';
import type { Whoami } from '../domain/identite.js';

export async function lireWhoami(code: string): Promise<Whoami> {
  const res = await appelerRpc<Whoami | null>('whoami', [argTexte(code)]);
  return exigerPresent(res, Erreurs.codeInconnu);
}
