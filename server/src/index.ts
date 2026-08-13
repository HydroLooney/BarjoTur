// Point d'entrée du BFF BarjoTur (Worker B). Lit l'environnement, crée l'app, écoute, et ferme proprement
// le pool à l'arrêt. Le live sert depuis DB2 (norvege_v2), autonome : il ne dépend jamais de DB1.
//
// Remplace le placeholder de fondation (C01). Couches : routes -> services -> db (SQL brut via `pg`).

import { lireEnv } from './env.js';
import { creerApp } from './app.js';
import { fermerPool } from './db/pool.js';

function demarrer(): void {
  const env = lireEnv();
  const app = creerApp(env);
  const serveur = app.listen(env.port, () => {
    console.log(`BFF BarjoTur à l'écoute sur le port ${env.port}.`);
  });

  const arreter = (signal: string): void => {
    console.log(`Signal ${signal} reçu, arrêt du BFF.`);
    serveur.close(() => {
      void fermerPool().finally(() => process.exit(0));
    });
  };
  process.on('SIGTERM', () => arreter('SIGTERM'));
  process.on('SIGINT', () => arreter('SIGINT'));
}

demarrer();
