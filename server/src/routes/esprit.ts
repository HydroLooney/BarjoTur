// Routes esprit de voyage (quiz A11/A12) sous /api/esprit/*. Minces. Non gaté PIN. Écriture idempotente.

import { Router } from 'express';
import { asyncHandler } from '../middleware/erreurs.js';
import { idempotence } from '../middleware/idempotence.js';
import { ok } from '../http/envelope.js';
import { exigerParam } from '../http/params.js';
import { validerEsprit, monEsprit, enregistrerEsprit, espritFamille, espritAggregate } from '../services/esprit.js';

export const routesEsprit = Router();

// Esprit famille (nominatif) et agrégat collégial : chemins à 2 segments, distincts de /esprit/:code.
routesEsprit.get(
  '/esprit/famille/:code',
  asyncHandler(async (req, res) => {
    res.json(ok(await espritFamille(exigerParam(req, 'code'))));
  }),
);

routesEsprit.get(
  '/esprit/aggregate/:code',
  asyncHandler(async (req, res) => {
    res.json(ok(await espritAggregate(exigerParam(req, 'code'))));
  }),
);

// Mon esprit (lecture).
routesEsprit.get(
  '/esprit/:code',
  asyncHandler(async (req, res) => {
    res.json(ok(await monEsprit(exigerParam(req, 'code'))));
  }),
);

// Enregistrer mon esprit.
routesEsprit.put(
  '/esprit/:code',
  idempotence,
  asyncHandler(async (req, res) => {
    res.json(ok(await enregistrerEsprit(exigerParam(req, 'code'), validerEsprit(req.body))));
  }),
);
