// Assemblage de l'application Express : parsing JSON, CORS maison (bornes d'origine par env), montage des
// routers sous /api, puis 404 et middleware d'erreurs en dernier. Pas de logique métier ici : app.ts ne fait
// que câbler. Les routes sont minces, les services portent le métier, la couche db parle à DB2.

import express from 'express';
import type { Express, RequestHandler } from 'express';
import type { Env } from './env.js';
import { routesSante } from './routes/sante.js';
import { routesVotes } from './routes/votes.js';
import { routesFige } from './routes/fige.js';
import { routesIdentite } from './routes/identite.js';
import { routesPoi } from './routes/poi.js';
import { routesComposeur } from './routes/composeur.js';
import { middlewareErreurs, middlewareIntrouvable } from './middleware/erreurs.js';

/** CORS minimal, piloté par l'environnement. Origines vides = permissif (dev local uniquement). */
function cors(origins: readonly string[]): RequestHandler {
  return (req, res, next) => {
    const origine = req.header('Origin');
    if (origins.length === 0) {
      res.setHeader('Access-Control-Allow-Origin', origine ?? '*');
    } else if (origine !== undefined && origins.includes(origine)) {
      res.setHeader('Access-Control-Allow-Origin', origine);
    }
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  };
}

export function creerApp(env: Env): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors(env.corsOrigins));
  app.use(express.json({ limit: '256kb' }));

  app.use('/api', routesSante);
  app.use('/api', routesIdentite);
  app.use('/api', routesVotes);
  app.use('/api', routesFige);
  app.use('/api', routesPoi);
  app.use('/api', routesComposeur);

  app.use(middlewareIntrouvable);
  app.use(middlewareErreurs);
  return app;
}
