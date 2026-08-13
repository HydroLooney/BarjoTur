// Couche db : appel générique des fonctions RPC `api.*` de DB2. C'est le point unique qui fronte
// la surface PostgREST héritée pendant la bascule (retrait PostgREST en 3 crans, cf B001).
// Le nom de fonction est validé contre une liste blanche : jamais d'identifiant construit depuis l'entrée.
// Les fonctions api.* renvoient du jsonb ; `pg` le désérialise déjà en objet JS.

import { query } from './query.js';

/** Liste blanche des fonctions RPC frontées. On l'étend au fil des chantiers, uniquement quand un service les câble. */
export const RPC_AUTORISEES = [
  'mes_votes',
  'set_votes',
  'set_vote',
  'fige_lire',
] as const;

export type RpcAutorisee = (typeof RPC_AUTORISEES)[number];

/** Un argument lié, avec un cast Postgres optionnel (ex. un objet passé en jsonb). */
export interface ArgRpc {
  valeur: unknown;
  cast?: 'text' | 'jsonb' | 'bigint';
}

/** Argument texte simple. */
export function argTexte(valeur: string | null): ArgRpc {
  return { valeur, cast: 'text' };
}

/** Argument jsonb : l'objet est sérialisé puis casté ::jsonb côté SQL. */
export function argJsonb(valeur: unknown): ArgRpc {
  return { valeur: JSON.stringify(valeur), cast: 'jsonb' };
}

/** Argument entier long (bigint). On passe la valeur en chaîne pour éviter toute perte de précision. */
export function argBigint(valeur: number): ArgRpc {
  return { valeur: String(valeur), cast: 'bigint' };
}

/**
 * Appelle `select api.<fn>($1, $2, ...)` et rend la valeur jsonb renvoyée, typée par l'appelant.
 * Le typage T est une promesse de forme : la vérité reste le contrat api.* de DB2.
 */
export async function appelerRpc<T>(fn: RpcAutorisee, args: readonly ArgRpc[] = []): Promise<T> {
  if (!RPC_AUTORISEES.includes(fn)) {
    // Garde-fou défensif : ne devrait jamais arriver, le type l'interdit déjà.
    throw new Error(`Fonction RPC non autorisée : ${fn}`);
  }
  const placeholders = args
    .map((a, i) => `$${i + 1}${a.cast ? `::${a.cast}` : ''}`)
    .join(', ');
  const texte = `select api.${fn}(${placeholders}) as resultat`;
  const valeurs = args.map((a) => a.valeur);
  const lignes = await query<{ resultat: T }>(texte, valeurs);
  return lignes[0]!.resultat;
}
