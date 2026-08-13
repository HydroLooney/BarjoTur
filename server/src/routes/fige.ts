// Routes fige : lecture d'un itinéraire figé (carte animée, fiche). Mince : valide l'id, appelle le service,
// emballe dans ApiReponse. La géométrie continue vient telle quelle de DB2 (source unique du rendu).

import { Router } from 'express';
import { asyncHandler } from '../middleware/erreurs.js';
import { ok } from '../http/envelope.js';
import { exigerParam } from '../http/params.js';
import { parseFigeId, lireFige, lireScenarioDefaut } from '../services/fige.js';

export const routesFige = Router();

// Profil par défaut (retenu, sinon consensus). Défini avant `/fige/:id` pour ne pas être capté comme un id.
routesFige.get(
  '/scenario-defaut',
  asyncHandler(async (_req, res) => {
    res.json(ok(await lireScenarioDefaut()));
  }),
);

routesFige.get(
  '/fige/:id',
  asyncHandler(async (req, res) => {
    const id = parseFigeId(exigerParam(req, 'id'));
    res.json(ok(await lireFige(id)));
  }),
);
