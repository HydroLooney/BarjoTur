// Lecture et validation de l'environnement du BFF. On échoue tôt, avec un message clair,
// plutôt que de laisser une connexion Postgres partir sur une chaîne vide.
// Secrets JAMAIS en dur : DATABASE_URL vient de l'environnement (secrets.env gitignoré).

export interface Env {
  /** DSN Postgres vers DB2 (norvege_v2). Fourni par secrets.env / l'orchestrateur, jamais commité. */
  databaseUrl: string;
  /** Port d'écoute du BFF. */
  port: number;
  /** Origines autorisées pour le front (CORS), séparées par des virgules. Vide = tout en dev local. */
  corsOrigins: string[];
  /** URL du sidecar composeur Python (OR-Tools). Ex. : http://localhost:8001 en dev, http://composeur en prod. */
  sidecarUrl: string;
}

function requis(cle: string): string {
  const v = process.env[cle];
  if (v === undefined || v.trim() === '') {
    throw new Error(
      `Variable d'environnement manquante : ${cle}. Renseignez-la via l'environnement ou secrets.env (jamais dans le dépôt).`,
    );
  }
  return v;
}

export function lireEnv(): Env {
  const port = Number.parseInt(process.env.PORT ?? '8080', 10);
  if (Number.isNaN(port)) {
    throw new Error(`PORT invalide : ${process.env.PORT}. Attendu un entier.`);
  }
  const corsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);

  // SIDECAR_URL peut être absent en dev (sans sidecar lancé) : on laisse une valeur par défaut.
  const sidecarUrl = (process.env.SIDECAR_URL ?? 'http://localhost:8001').replace(/\/$/, '');

  return {
    databaseUrl: requis('DATABASE_URL'),
    port,
    corsOrigins,
    sidecarUrl,
  };
}
