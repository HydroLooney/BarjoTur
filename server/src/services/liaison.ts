// Service variantes de liaison (M173 §2, T045) : quand C ouvre une liaison base→base, il voit le FRONT de Pareto
// temps↔€ (les alternatives rationnelles « ferry 1 h / 30 € vs route 2 h 10 / gratuit ») + la variante par défaut.
// GÉNÉRATION des variantes = A (matrice, A* à exclusions, corridor) ; SÉLECTION/tri = arbitrage shared (frontPareto).
// Passe-plat flip-ready : dégradation propre tant qu'A n'a pas posé `variante_liaison` (200 vide, pas de 500).

import { appelerRpc, argEntier, siRpcAbsente } from '../db/rpc.js';
import { Erreurs } from '../http/erreurs.js';
import { frontPareto } from '../domain/arbitrage.js';
import type { VarianteLiaison } from '../domain/arbitrage.js';

/** Le comparateur d'une liaison : le front de Pareto (choix rationnels) + la variante par défaut (optimale en temps). */
export interface ComparateurLiaison {
  front: VarianteLiaison[];
  defaut: VarianteLiaison | null;
}

/** Valide un identifiant de base d'URL (de/vers) : entier positif. Pure. */
export function parseBaseId(brut: string, nom: string): number {
  const id = Number(brut);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw Erreurs.requeteInvalide(`Identifiant de base invalide (${nom}) : ${brut}. Attendu un entier positif.`);
  }
  return id;
}

/** Assemble le comparateur depuis les variantes brutes : front de Pareto (temps↔€) + la variante `defaut` (sinon la
 *  première du front). Pure. */
export function assemblerVariantes(variantes: VarianteLiaison[]): ComparateurLiaison {
  const front = frontPareto(variantes);
  const defaut = variantes.find((x) => x.mode === 'defaut') ?? front[0] ?? null;
  return { front, defaut };
}

/** Variantes d'une liaison de→vers (passe-plat de `api.variante_liaison`). Dégradation propre si A n'a pas encore posé
 *  la RPC (42883 → comparateur vide). */
export async function lireVariantesLiaison(de: number, vers: number, rpc = appelerRpc): Promise<ComparateurLiaison> {
  const variantes = await siRpcAbsente(
    rpc<VarianteLiaison[] | null>('variante_liaison', [argEntier(de), argEntier(vers)]),
    null,
  );
  return assemblerVariantes(variantes ?? []);
}
