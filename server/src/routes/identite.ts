// Route identité : bootstrap du voyageur depuis son lien perso. Mince. Non gaté PIN.

import { Router } from 'express';
import { asyncHandler } from '../middleware/erreurs.js';
import { ok } from '../http/envelope.js';
import { exigerParam } from '../http/params.js';
import { lireWhoami } from '../services/identite.js';

export const routesIdentite = Router();

routesIdentite.get(
  '/whoami/:code',
  asyncHandler(async (req, res) => {
    res.json(ok(await lireWhoami(exigerParam(req, 'code'))));
  }),
);
