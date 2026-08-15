// Route agenda du jour (#4, M527) : l'agenda de « Mon voyage » du porteur du lien, mappé au contrat shared AgendaVoyage.
// Mince : appelle le service (compose + mapping), emballe. Le rendu (carte du jour, barre d'animation) = surface de C.

import { Router } from 'express';
import { asyncHandler } from '../middleware/erreurs.js';
import { ok } from '../http/envelope.js';
import { exigerParam } from '../http/params.js';
import { lireAgenda } from '../services/agenda.js';

export const routesAgenda = Router();

/**
 * GET /api/agenda/:code
 *
 * Compose « Mon voyage » (pondéré par le profil philosophie du voyageur) avec agenda, et renvoie AgendaVoyage
 * (jours + activités regroupées par moment + confort + ancres ferry). Champs pas encore calculés = null (R1).
 */
routesAgenda.get(
  '/agenda/:code',
  asyncHandler(async (req, res) => {
    res.json(ok(await lireAgenda(exigerParam(req, 'code'))));
  }),
);
