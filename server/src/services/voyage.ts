// Service instance voyage (A19 §9, M055) : lecture de l'instance (origine/destination/titre). Passe-plat de la RPC
// api.voyage_lire. Multi-voyage-ready : tout est clé voyage_id, aucun voyage codé en dur. Lecture ouverte au lien.

import { appelerRpc, argBigint } from '../db/rpc.js';
import type { Voyage } from '../domain/voyage.js';

/** L'instance voyage (titre, point_depart, point_arrivee). Passe-plat. */
export async function lireVoyage(voyageId: number): Promise<Voyage> {
  return appelerRpc<Voyage>('voyage_lire', [argBigint(voyageId)]);
}
