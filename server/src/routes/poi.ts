// Routes POI (Explorer, T015) : catalogue votable et requête d'emprise. Minces. Aucun SQL ici.

import { Router } from 'express';
import { asyncHandler } from '../middleware/erreurs.js';
import { ok } from '../http/envelope.js';
import { parseBbox, lireCatalogue, lirePoiDansEmprise } from '../services/poi.js';

export const routesPoi = Router();

// Catalogue des POI votables (488).
routesPoi.get(
  '/catalogue',
  asyncHandler(async (_req, res) => {
    res.json(ok(await lireCatalogue()));
  }),
);

// POI dans une emprise carto : /api/poi/bbox?minlon=&minlat=&maxlon=&maxlat=
routesPoi.get(
  '/poi/bbox',
  asyncHandler(async (req, res) => {
    const bbox = parseBbox(req.query as Record<string, unknown>);
    res.json(ok(await lirePoiDansEmprise(bbox)));
  }),
);
