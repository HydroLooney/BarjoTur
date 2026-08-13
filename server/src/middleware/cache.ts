// En-têtes de cache (PWA-ready, C11). Politique conservatrice, sûre par défaut :
//   - écritures (PUT/POST/DELETE) : `no-store` (jamais de rejeu de cache d'une mutation).
//   - lectures (GET) : `private, no-cache` — le navigateur et le service worker PEUVENT stocker, mais doivent
//     revalider avant usage. L'app sert un cercle familial derrière lien perso : rien de public/partagé en cache.
// L'offline réel est géré côté service worker (front, C) ; le serveur ne fait que poser des en-têtes cohérents.

import type { RequestHandler } from 'express';

export const entetesCache: RequestHandler = (req, res, next) => {
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'private, no-cache');
  } else {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
};
