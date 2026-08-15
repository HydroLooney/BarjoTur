// Route variantes de liaison (M173 §2) : GET /api/liaison/:de/:vers/variantes → comparateur temps↔€ (front de Pareto +
// défaut). Chargé à la DEMANDE (quand C ouvre une liaison), pas en masse. Passe-plat flip-ready (dégradation propre).

import { Router } from 'express';
import { asyncHandler } from '../middleware/erreurs.js';
import { ok } from '../http/envelope.js';
import { exigerParam } from '../http/params.js';
import { parseBaseId, lireVariantesLiaison } from '../services/liaison.js';

export const routesLiaison = Router();

routesLiaison.get(
  '/liaison/:de/:vers/variantes',
  asyncHandler(async (req, res) => {
    const de = parseBaseId(exigerParam(req, 'de'), 'de');
    const vers = parseBaseId(exigerParam(req, 'vers'), 'vers');
    res.json(ok(await lireVariantesLiaison(de, vers)));
  }),
);
