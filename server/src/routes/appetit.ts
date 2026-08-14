// Routes appétit thématique (M097/M092) : lire ses envies, en régler une. Le voyageur est identifié par son lien
// (`:code`, convention app). Lecture ouverte au lien ; écriture gatée capacité `voter` (autorité serveur) + idempotente.
// Données précieuses (hors sync B-15). Persistance DB2 câblée au flip (RPC api.appetit_*, migration 009).

import { Router } from 'express';
import { asyncHandler } from '../middleware/erreurs.js';
import { idempotence } from '../middleware/idempotence.js';
import { ok } from '../http/envelope.js';
import { exigerParam } from '../http/params.js';
import { validerAppetit, lireAppetits, ecrireAppetit } from '../services/appetit.js';

export const routesAppetit = Router();

routesAppetit.get(
  '/appetit/:code',
  asyncHandler(async (req, res) => {
    res.json(ok(await lireAppetits(exigerParam(req, 'code'))));
  }),
);

routesAppetit.put(
  '/appetit/:code',
  idempotence,
  asyncHandler(async (req, res) => {
    res.json(ok(await ecrireAppetit(exigerParam(req, 'code'), validerAppetit(req.body))));
  }),
);
