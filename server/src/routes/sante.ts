// Route de santé : vérifie que le BFF répond et que DB2 est joignable (select 1). Sert au monitoring et
// à la recette de déploiement. DB2 est autonome ; un échec ici signale un souci d'infra, pas de DB1.

import { Router } from 'express';
import { asyncHandler } from '../middleware/erreurs.js';
import { ok } from '../http/envelope.js';
import { query } from '../db/query.js';

export const routesSante = Router();

routesSante.get(
  '/sante',
  asyncHandler(async (_req, res) => {
    const lignes = await query<{ un: number }>('select 1 as un');
    res.json(ok({ service: 'bff', db2: lignes[0]?.un === 1 ? 'ok' : 'inconnu' }));
  }),
);
