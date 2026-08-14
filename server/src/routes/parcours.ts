// Routes machine à crans (A18, M047) : état du parcours et transitions (valider/verrouiller/rouvrir).
// GET /api/parcours/:voyage_id (lecture ouverte au lien) ; POST /api/parcours/:voyage_id/transition (gaté rôle
// organisateur : le rôle est résolu par whoami depuis le `code` du corps ; l'engine tranche AVANT toute écriture).
// Écriture idempotente. La persistance DB2 se câble au flip (RPC api.parcours_*).

import { Router } from 'express';
import { asyncHandler } from '../middleware/erreurs.js';
import { idempotence } from '../middleware/idempotence.js';
import { ok } from '../http/envelope.js';
import { exigerParam } from '../http/params.js';
import { lireWhoami } from '../services/identite.js';
import { validerTransition, parseVoyageId, lireParcours, transiterParcours } from '../services/parcours.js';

export const routesParcours = Router();

// État d'avancement du parcours (les crans et leur validation). Lecture ouverte au lien.
routesParcours.get(
  '/parcours/:voyage_id',
  asyncHandler(async (req, res) => {
    const voyageId = parseVoyageId(exigerParam(req, 'voyage_id'));
    res.json(ok(await lireParcours(voyageId)));
  }),
);

// Transition d'un cran. Le corps porte { code, action, cran } ; le rôle vient de whoami(code). ok:false = refus métier.
routesParcours.post(
  '/parcours/:voyage_id/transition',
  idempotence,
  asyncHandler(async (req, res) => {
    const voyageId = parseVoyageId(exigerParam(req, 'voyage_id'));
    const { code, pin, action, cran } = validerTransition(req.body);
    const qui = await lireWhoami(code);
    const resultat = await transiterParcours(voyageId, action, cran, pin, {
      role: qui.role,
      par: qui.membre_id,
      maintenant: new Date().toISOString(),
    });
    res.json(ok(resultat));
  }),
);
