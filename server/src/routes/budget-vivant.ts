// Route budget vivant (#3, M547) : les 3 sources (marges expert + itinéraire + réservations) confrontées, EUR-only.
// Mince : appelle le service, emballe. Le rendu (fourchette, réservations, alerte cap) = surface de C.

import { Router } from 'express';
import { asyncHandler } from '../middleware/erreurs.js';
import { ok } from '../http/envelope.js';
import { exigerParam } from '../http/params.js';
import { lireBudgetVivant } from '../services/budget-vivant.js';

export const routesBudgetVivant = Router();

/** GET /api/budget-vivant/:code → BudgetVivant (prévisionnel + engagé + suivi, caps, devise EUR). */
routesBudgetVivant.get(
  '/budget-vivant/:code',
  asyncHandler(async (req, res) => {
    res.json(ok(await lireBudgetVivant(exigerParam(req, 'code'))));
  }),
);
