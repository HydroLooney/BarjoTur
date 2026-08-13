// Service fige : lecture d'un itinéraire figé versionné (api.fige_lire) pour la carte animée et la fiche.
// Ne connaît pas Express. La géométrie renvoyée est la source unique (continue), jamais recollée leg par leg.

import { appelerRpc, argBigint } from '../db/rpc.js';
import { Erreurs, exigerPresent } from '../http/erreurs.js';
import type { FigeDetail, ScenarioDefaut } from '../domain/fige.js';

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
export async function lireFige(id: number): Promise<FigeDetail> {
  const res = await appelerRpc<FigeDetail | null>('fige_lire', [argBigint(id)]);
  return exigerPresent(res, Erreurs.figeIntrouvable);
}

/**
 * Profil d'itinéraire à afficher par défaut : le retenu, sinon le consensus, sinon aucun.
 * Sert de point d'entrée à la carte pour la vérif visuelle (C, gate C16). Jamais 404 : rend {source:'aucun'} si vide.
 */
export async function lireScenarioDefaut(): Promise<ScenarioDefaut> {
  return appelerRpc<ScenarioDefaut>('scenario_defaut', []);
}

/** Galerie des archétypes (dernière version figée par archétype) : à parcourir, comparer, voter. Passe-plat. */
export async function lesArchetypes(): Promise<unknown> {
  return appelerRpc<unknown>('archetypes', []);
}
