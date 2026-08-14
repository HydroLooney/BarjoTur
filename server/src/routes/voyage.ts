// Route instance voyage (A19 §9, M055) : GET /api/voyage/:voyage_id. Mince, lecture ouverte au lien.

import { Router } from 'express';
import { asyncHandler } from '../middleware/erreurs.js';
import { ok } from '../http/envelope.js';
import { exigerParam } from '../http/params.js';
import { parseVoyageId } from '../services/parcours.js';
import { lireVoyage } from '../services/voyage.js';

export const routesVoyage = Router();

routesVoyage.get(
  '/voyage/:voyage_id',
  asyncHandler(async (req, res) => {
    res.json(ok(await lireVoyage(parseVoyageId(exigerParam(req, 'voyage_id')))));
  }),
);
