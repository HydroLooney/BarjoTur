// Route « Mon voyage idéal » (P0, M554) : GET /api/mon-voyage/:code → l'itinéraire idéal du voyageur + son écart au commun.
// Mince : appelle le service, emballe. Le rendu (couple miroir Moi↔Nous) = surface de C (MonVoyage.tsx).

import { Router } from 'express';
import { asyncHandler } from '../middleware/erreurs.js';
import { ok } from '../http/envelope.js';
import { exigerParam } from '../http/params.js';
import { lireMonVoyage } from '../services/mon-voyage.js';

export const routesMonVoyage = Router();

/** GET /api/mon-voyage/:code → MonVoyageIdeal (idéal composé pour le seul profil du voyageur ; ecart au commun = null R1). */
routesMonVoyage.get(
  '/mon-voyage/:code',
  asyncHandler(async (req, res) => {
    res.json(ok(await lireMonVoyage(exigerParam(req, 'code'))));
  }),
);
