// Service circuits + zones-activités (M107/A23) : bibliothèque des circuits tout-faits des guides et activité idéale
// par zone. LECTURE seule (ces objets viennent des guides, pas des voyageurs). Passe-plats des RPC api.circuits_lire /
// circuit_lire / zones_activites_lire, RPC injectée (défaut appelerRpc) pour l'e2e. Flip-ready : les données réelles
// viennent d'A (tables circuit / zone_activite_ideale) au flip ; d'ici là fixtures. Ne connaît pas Express.

import { appelerRpc, argTexte, argEntier } from '../db/rpc.js';
import { Erreurs } from '../http/erreurs.js';
import type { Circuit, ZoneActiviteIdeale, ModeCircuit, DureeCircuit } from '../domain/circuit.js';

const MODES: readonly ModeCircuit[] = ['pied', 'velo', 'voiture', 'van', 'train', 'bateau', 'mixte'];
const DUREES: readonly DureeCircuit[] = ['demi_journee', '24h', 'journee', 'jours'];

/** Filtres de la bibliothèque de circuits (tous optionnels). Durée et mode contraints à l'énumération, zone libre. */
export interface FiltresCircuit {
  zone?: string;
  duree?: DureeCircuit;
  mode?: ModeCircuit;
}

/** Valide l'identifiant de circuit d'URL : entier positif sûr. Pure. */
export function parseCircuitId(brut: string): number {
  const id = Number(brut);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw Erreurs.requeteInvalide(`Identifiant de circuit invalide : ${brut}. Attendu un entier positif.`);
  }
  return id;
}

/** Valide/normalise les filtres (query). Une valeur non-string est ignorée (query malformée) ; une durée/mode hors
 *  énumération est refusée (400). Pure. */
export function validerFiltresCircuit(query: unknown): FiltresCircuit {
  const q = (typeof query === 'object' && query !== null ? query : {}) as Record<string, unknown>;
  const out: FiltresCircuit = {};
  if (typeof q.zone === 'string' && q.zone.trim() !== '') out.zone = q.zone;
  if (typeof q.duree === 'string') {
    if (!(DUREES as readonly string[]).includes(q.duree)) throw Erreurs.requeteInvalide(`Durée inconnue : ${q.duree}.`);
    out.duree = q.duree as DureeCircuit;
  }
  if (typeof q.mode === 'string') {
    if (!(MODES as readonly string[]).includes(q.mode)) throw Erreurs.requeteInvalide(`Mode inconnu : ${q.mode}.`);
    out.mode = q.mode as ModeCircuit;
  }
  return out;
}

/** Bibliothèque des circuits, filtrée. Passe-plat (filtres → args RPC, null = pas de filtre). */
export async function lireCircuits(filtres: FiltresCircuit, rpc = appelerRpc): Promise<Circuit[]> {
  const res = await rpc<Circuit[] | null>('circuits_lire', [
    argTexte(filtres.zone ?? null),
    argTexte(filtres.duree ?? null),
    argTexte(filtres.mode ?? null),
  ]);
  return res ?? [];
}

/** Détail d'un circuit (étapes ordonnées). Passe-plat ; null si absent. */
export async function lireCircuit(id: number, rpc = appelerRpc): Promise<Circuit | null> {
  return rpc<Circuit | null>('circuit_lire', [argEntier(id)]);
}

/** Activité idéale par zone (filtrable par zone). Passe-plat. */
export async function lireZonesActivites(zone: string | undefined, rpc = appelerRpc): Promise<ZoneActiviteIdeale[]> {
  const res = await rpc<ZoneActiviteIdeale[] | null>('zones_activites_lire', [argTexte(zone ?? null)]);
  return res ?? [];
}
