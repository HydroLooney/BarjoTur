// Couche db : helper de requête paramétrée. Toute requête passe par des paramètres liés ($1, $2...),
// jamais par concaténation de chaînes (anti-injection). Les routes et services n'appellent jamais `pg`
// directement : ils passent par ce module et par rpc.ts.

import type { QueryResultRow } from 'pg';
import { obtenirPool } from './pool.js';

/** Exécute une requête paramétrée et rend les lignes typées. */
export async function query<T extends QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const pool = obtenirPool();
  const res = await pool.query<T>(text, params as unknown[]);
  return res.rows;
}
