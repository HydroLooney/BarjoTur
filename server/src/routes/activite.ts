// Route budget-temps POI (A048/M089) : GET /api/budget-temps/:poi_id. Mince, lecture. Passe-plat flip-ready (DSN +
// producteur A). C lit la durée + les thèmes pour l'affichage/curseur ; B reste l'autorité du budget-jour.

import { Router } from 'express';
import { asyncHandler } from '../middleware/erreurs.js';
import { ok } from '../http/envelope.js';
import { exigerParam } from '../http/params.js';
import { parsePoiId, lireBudgetTempsPoi } from '../services/activite.js';

export const routesActivite = Router();

routesActivite.get(
  '/budget-temps/:poi_id',
  asyncHandler(async (req, res) => {
    res.json(ok(await lireBudgetTempsPoi(parsePoiId(exigerParam(req, 'poi_id')))));
  }),
);
