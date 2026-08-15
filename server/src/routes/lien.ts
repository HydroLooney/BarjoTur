// Routes liens d'invitation (A34/M173/M176) : générer / révoquer un lien par portée. Organisateur identifié par son
// `code` (path) ; autorité peut(administrer_voyageurs) + PIN côté RPC. Idempotence sur les mutations. Données précieuses.

import { Router } from 'express';
import { asyncHandler } from '../middleware/erreurs.js';
import { idempotence } from '../middleware/idempotence.js';
import { ok } from '../http/envelope.js';
import { exigerParam } from '../http/params.js';
import { parseVoyageId } from '../services/voyageurs.js';
import { validerDemandeGenererLien, validerDemandeRevoquerLien, genererLien, revoquerLien } from '../services/lien.js';

export const routesLien = Router();

// Générer un lien de partage (portée). Corps { portee, prenom?, espacesVisibles?, pin }. Rend le nouveau Voyageur.
routesLien.post(
  '/voyageurs/:voyage_id/:code/lien',
  idempotence,
  asyncHandler(async (req, res) => {
    const voyageId = parseVoyageId(exigerParam(req, 'voyage_id'));
    const demande = validerDemandeGenererLien(req.body);
    res.json(ok(await genererLien(voyageId, exigerParam(req, 'code'), demande)));
  }),
);

// Révoquer un lien cible. Corps { code (cible), pin }.
routesLien.post(
  '/voyageurs/:voyage_id/:code/revoquer',
  idempotence,
  asyncHandler(async (req, res) => {
    const voyageId = parseVoyageId(exigerParam(req, 'voyage_id'));
    const demande = validerDemandeRevoquerLien(req.body);
    res.json(ok(await revoquerLien(voyageId, exigerParam(req, 'code'), demande)));
  }),
);
