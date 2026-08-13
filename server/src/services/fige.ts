// Service fige : lecture d'un itinéraire figé versionné (api.fige_lire) pour la carte animée et la fiche.
// Ne connaît pas Express. La géométrie renvoyée est la source unique (continue), jamais recollée leg par leg.

import { appelerRpc, argBigint } from '../db/rpc.js';
import { Erreurs } from '../http/erreurs.js';
import type { FigeLu } from '../domain/fige.js';

/** Analyse et valide un identifiant de figé. fige_id est un bigint strictement positif. Pure, testable sans DB. */
export function parseFigeId(brut: string): number {
  if (!/^\d+$/.test(brut)) {
    throw Erreurs.requeteInvalide('Identifiant de figé invalide (entier attendu).');
  }
  const id = Number(brut);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw Erreurs.requeteInvalide('Identifiant de figé hors bornes (> 0 attendu).');
  }
  return id;
}

/** Lit l'itinéraire figé complet (métadonnées, géométrie continue, agenda, waypoints). 404 si inconnu. */
export async function lireFige(id: number): Promise<FigeLu> {
  const res = await appelerRpc<FigeLu | null>('fige_lire', [argBigint(id)]);
  if (res === null || res === undefined) {
    throw Erreurs.figeIntrouvable();
  }
  return res;
}
