// Couche db : un seul pool de connexions Postgres vers DB2 (norvege_v2), en SQL brut via `pg`.
// Pas de Prisma sur le spatial : on garde toute la puissance PostGIS/pgRouting (arbitrage #4 du Plan v3).
// Le pool est un singleton paresseux, créé au premier accès, à partir de l'environnement validé.

import { Pool } from 'pg';
import { lireEnv } from '../env.js';

let pool: Pool | undefined;

/** Retourne le pool partagé, créé une seule fois. DB2 est autonome au runtime (le live ne dépend jamais de DB1). */
export function obtenirPool(): Pool {
  if (pool === undefined) {
    const env = lireEnv();
    pool = new Pool({
      connectionString: env.databaseUrl,
      // Bornes prudentes : DB2 sert un cercle familial, pas une charge publique.
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

/** Ferme proprement le pool (arrêt du serveur, tests). Idempotent. */
export async function fermerPool(): Promise<void> {
  if (pool !== undefined) {
    const p = pool;
    pool = undefined;
    await p.end();
  }
}
