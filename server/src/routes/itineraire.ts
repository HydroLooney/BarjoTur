// Route itinéraire mixte (composeur transit-aware, M059) : POST /api/itineraire orchestre une suite d'étapes typées
// expérience/transit. Mince : valide, orchestre (expérience via composeur, transit préparé/gaté corridor), emballe.

import { Router } from 'express';
import { asyncHandler } from '../middleware/erreurs.js';
import { ok } from '../http/envelope.js';
import { validerEtapesItineraire, orchestrerItineraire } from '../services/itineraire.js';

export const routesItineraire = Router();

routesItineraire.post(
  '/itineraire',
  asyncHandler(async (req, res) => {
    const etapes = validerEtapesItineraire(req.body);
    res.json(ok(await orchestrerItineraire(etapes)));
  }),
);
