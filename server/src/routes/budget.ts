// Routes budget et paramètres (Budget C13, Coulisses C09). Minces, lecture seule.

import { Router } from 'express';
import { asyncHandler } from '../middleware/erreurs.js';
import { ok } from '../http/envelope.js';
import { exigerParam } from '../http/params.js';
import { parseFigeId } from '../services/fige.js';
import { budgetComparatif, budgetVariante, lesParametres } from '../services/budget.js';

export const routesBudget = Router();

// Budgets comparés par scénario.
routesBudget.get(
  '/budget/comparatif',
  asyncHandler(async (_req, res) => {
    res.json(ok(await budgetComparatif()));
  }),
);

// Budget d'un itinéraire figé.
routesBudget.get(
  '/budget/variante/:figeId',
  asyncHandler(async (req, res) => {
    res.json(ok(await budgetVariante(parseFigeId(exigerParam(req, 'figeId')))));
  }),
);

// Registre single-source des paramètres (Coulisses).
routesBudget.get(
  '/parametres',
  asyncHandler(async (_req, res) => {
    res.json(ok(await lesParametres()));
  }),
);
