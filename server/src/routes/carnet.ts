// Routes carnet perso (Explorer, T015) sous /api/carnet/:code/*. Minces. Écritures idempotentes.
// Identité = lien perso (code) ; ajout et signalement portent le PIN dans le corps (vérifié côté RPC).

import { Router } from 'express';
import { asyncHandler } from '../middleware/erreurs.js';
import { idempotence } from '../middleware/idempotence.js';
import { ok } from '../http/envelope.js';
import { exigerParam } from '../http/params.js';
import {
  validerAjoutPoi,
  validerSignal,
  ajouterLieu,
  lesPropositions,
  mesLieuxParTier,
  signalerPoi,
  lesSignalements,
} from '../services/carnet.js';

export const routesCarnet = Router();

// Ajouter un lieu au carnet (voyageur, gaté PIN).
routesCarnet.post(
  '/carnet/:code/poi',
  idempotence,
  asyncHandler(async (req, res) => {
    const input = validerAjoutPoi(req.body);
    res.json(ok(await ajouterLieu(exigerParam(req, 'code'), input)));
  }),
);

// Mes propositions de lieux.
routesCarnet.get(
  '/carnet/:code/propositions',
  asyncHandler(async (req, res) => {
    res.json(ok(await lesPropositions(exigerParam(req, 'code'))));
  }),
);

// Mes lieux par tier.
routesCarnet.get(
  '/carnet/:code/mes-lieux',
  asyncHandler(async (req, res) => {
    res.json(ok(await mesLieuxParTier(exigerParam(req, 'code'))));
  }),
);

// Signaler un POI (gaté PIN).
routesCarnet.post(
  '/carnet/:code/signaler',
  idempotence,
  asyncHandler(async (req, res) => {
    const s = validerSignal(req.body);
    res.json(ok(await signalerPoi(exigerParam(req, 'code'), s)));
  }),
);

// Signalements ouverts (modération).
routesCarnet.get(
  '/carnet/:code/signalements',
  asyncHandler(async (req, res) => {
    res.json(ok(await lesSignalements(exigerParam(req, 'code'))));
  }),
);
