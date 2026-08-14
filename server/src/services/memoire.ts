// Service mémoire perso : exploration (marque vu/exploré) et collections génériques (dont l'intendance).
// Ne connaît pas Express. Identité = lien perso (code), non gaté PIN (mémoire non destructive, A03/M026).
// Passe-plat des RPC api.exploration_* / api.collection_* (migration 002, A018). La RPC revalide côté serveur
// (autorité serveur) ; le BFF valide d'abord pour un 400 clair et rapide.

import { appelerRpc, argTexte, argJsonb } from '../db/rpc.js';
import { Erreurs } from '../http/erreurs.js';
import type { MarqueInput, ContenuCollection, StatutExploration } from '../domain/memoire.js';
import type { ExplorationLue, CollectionLue, EcritureMemoireResult } from '@barjotur/shared';

const STATUTS: readonly StatutExploration[] = ['vu', 'explore'];

/** Vrai si le statut est un statut d'exploration connu. */
export function estStatutValide(brut: unknown): brut is StatutExploration {
  return typeof brut === 'string' && (STATUTS as readonly string[]).includes(brut);
}

/** Valide et normalise une marque d'exploration (osm_id non vide + statut connu). Pure, testable sans DB. */
export function validerMarque(corps: unknown): MarqueInput {
  if (typeof corps !== 'object' || corps === null || Array.isArray(corps)) {
    throw Erreurs.requeteInvalide('Le corps attendu est un objet JSON.');
  }
  const c = corps as Record<string, unknown>;
  if (typeof c.osm_id !== 'string' || c.osm_id.trim() === '') {
    throw Erreurs.requeteInvalide('Champ requis manquant ou vide : osm_id.');
  }
  if (!estStatutValide(c.statut)) {
    throw Erreurs.requeteInvalide("Statut invalide : attendu 'vu' ou 'explore'.");
  }
  return { osm_id: c.osm_id, statut: c.statut };
}

/** Valide un contenu de collection : un blob JSON (objet ou tableau), jamais un scalaire ni null. Pure. */
export function validerContenu(corps: unknown): ContenuCollection {
  if (typeof corps !== 'object' || corps === null) {
    throw Erreurs.requeteInvalide('Le contenu attendu est un objet ou un tableau JSON.');
  }
  return corps as ContenuCollection;
}

/** Mes marques d'exploration (vu/exploré). 404 non pertinent : passe-plat, ok:false = code inconnu. */
export async function lireExploration(code: string): Promise<ExplorationLue> {
  return appelerRpc<ExplorationLue>('exploration_lire', [argTexte(code)]);
}

/** Marque un POI vu/exploré (upsert idempotent côté RPC). */
export async function marquerExploration(code: string, m: MarqueInput): Promise<EcritureMemoireResult> {
  return appelerRpc<EcritureMemoireResult>('exploration_marquer', [argTexte(code), argTexte(m.osm_id), argTexte(m.statut)]);
}

/** Lit une collection perso par clé (contenu null si absente, pas d'erreur). */
export async function lireCollection(code: string, cle: string): Promise<CollectionLue> {
  return appelerRpc<CollectionLue>('collection_lire', [argTexte(code), argTexte(cle)]);
}

/** Écrit une collection perso par clé (upsert idempotent, blob versionné). */
export async function ecrireCollection(code: string, cle: string, contenu: ContenuCollection): Promise<EcritureMemoireResult> {
  return appelerRpc<EcritureMemoireResult>('collection_ecrire', [argTexte(code), argTexte(cle), argJsonb(contenu)]);
}
