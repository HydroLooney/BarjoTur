// Service appétit thématique (M097/M092) : lire les envies d'un voyageur, en écrire une. Données PRÉCIEUSES
// (préférence vivante, decision.* : hors sync B-15). Ne connaît pas Express. AUTORITÉ SERVEUR à l'écriture : capacité
// `voter` (carte partagée `peut`, M077) — un invité ne règle pas ses envies. Passe-plat des RPC api.appetit_*.
// Flip-ready : logique + garde testées ; les RPC (009) se jouent au flip (DSN).

import { appelerRpc, argTexte, argFloat } from '../db/rpc.js';
import { Erreurs, ErreurRequete } from '../http/erreurs.js';
import { lireWhoami } from './identite.js';
import { exigerCapacite } from './voyageurs.js';
import type { AppetitThematique } from '../domain/appetit.js';

/** Valide le corps d'écriture { theme (non vide), appetit ∈ [0,1] }. Pure. */
export function validerAppetit(corps: unknown): AppetitThematique {
  if (typeof corps !== 'object' || corps === null || Array.isArray(corps)) {
    throw Erreurs.requeteInvalide('Le corps attendu est un objet JSON { theme, appetit }.');
  }
  const c = corps as Record<string, unknown>;
  if (typeof c.theme !== 'string' || c.theme.trim() === '') {
    throw Erreurs.requeteInvalide('Champ requis manquant ou vide : theme.');
  }
  if (typeof c.appetit !== 'number' || Number.isNaN(c.appetit) || c.appetit < 0 || c.appetit > 1) {
    throw Erreurs.requeteInvalide('appetit doit être un nombre dans [0, 1].');
  }
  return { theme: c.theme, appetit: c.appetit };
}

/** Les appétits thématiques du membre porteur du lien. Passe-plat. Lecture ouverte au lien. */
export async function lireAppetits(code: string): Promise<AppetitThematique[]> {
  const res = await appelerRpc<AppetitThematique[] | null>('appetit_lire', [argTexte(code)]);
  return res ?? [];
}

/** Écrit (upsert) un appétit du voyageur porteur du lien. Gaté capacité `voter` (autorité serveur). Idempotent. */
export async function ecrireAppetit(code: string, appetit: AppetitThematique): Promise<AppetitThematique> {
  const qui = await lireWhoami(code);
  exigerCapacite(qui.role, 'voter');
  const res = await appelerRpc<{ ok: boolean; error?: string; theme?: string; appetit?: number }>('appetit_ecrire', [
    argTexte(code),
    argTexte(appetit.theme),
    argFloat(appetit.appetit),
  ]);
  if (!res?.ok) throw new ErreurRequete(400, 'appetit_refuse', res?.error ?? 'Appétit refusé.');
  return { theme: res.theme ?? appetit.theme, appetit: res.appetit ?? appetit.appetit };
}
