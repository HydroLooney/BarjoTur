// Service budget-temps POI (A048/M089) : passe-plat de `api.budget_temps_poi`. Ne connaît pas Express. Flip-ready :
// la RPC (DB2) lit le producteur statique d'A (dérivé DB1 `diffusion.v_web_poi_activite`, synchronisé par B-15) et
// applique la modulation LIVE (avis agrégés + appétits thématiques) de l'état DB2, puis clamp × arrondi 15 × palier
// (formule partagée A, module calc/lib). Côté BFF on ne fait QUE fronter : aucune règle ici. Gaté DSN + producteur A
// (la RPC rend vide tant que le mapping POI→type_activite n'est pas rempli — A le tranche en R13). Migration 008 =
// à écrire quand A fige la table dérivée DB2 + le module de formule partagé (on ne devine pas le SQL avant).

import { appelerRpc, argEntier } from '../db/rpc.js';
import { Erreurs } from '../http/erreurs.js';
import type { BudgetTempsPoi } from '../domain/activite.js';

/** Valide l'identifiant de POI d'URL : entier positif sûr. Pure. */
export function parsePoiId(brut: string): number {
  const id = Number(brut);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw Erreurs.requeteInvalide(`Identifiant de POI invalide : ${brut}. Attendu un entier positif.`);
  }
  return id;
}

/** Lit le budget-temps résolu d'un POI (durée modulée + thèmes). Passe-plat de la RPC. Flip-ready (DSN + producteur A). */
export async function lireBudgetTempsPoi(poiId: number): Promise<BudgetTempsPoi> {
  return appelerRpc<BudgetTempsPoi>('budget_temps_poi', [argEntier(poiId)]);
}
