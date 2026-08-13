// Routes fige : lecture d'un itinéraire figé (carte animée, fiche). Mince : valide l'id, appelle le service,
// emballe dans ApiReponse. La géométrie continue vient telle quelle de DB2 (source unique du rendu).

import { Router } from 'express';
import { asyncHandler } from '../middleware/erreurs.js';
import { ok } from '../http/envelope.js';
import { exigerParam } from '../http/params.js';
import { parseFigeId, lireFige } from '../services/fige.js';

export const routesFige = Router();

routesFige.get(
  '/fige/:id',
  asyncHandler(async (req, res) => {
    const id = parseFigeId(exigerParam(req, 'id'));
    res.json(ok(await lireFige(id)));
  }),
);
