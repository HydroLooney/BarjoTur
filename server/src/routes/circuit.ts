// Routes circuits + zones-activités (M107/A23) : bibliothèque des circuits des guides et activité idéale par zone.
// LECTURE seule (pas d'écriture : ces objets viennent des guides). Passe-plats flip-ready (DSN + données d'A).

import { Router } from 'express';
import { asyncHandler } from '../middleware/erreurs.js';
import { ok } from '../http/envelope.js';
import { exigerParam } from '../http/params.js';
import { parseCircuitId, validerFiltresCircuit, lireCircuits, lireCircuit, lireZonesActivites } from '../services/circuit.js';

export const routesCircuit = Router();

// Bibliothèque des circuits, filtrable (?zone=&duree=&mode=).
routesCircuit.get(
  '/circuits',
  asyncHandler(async (req, res) => {
    res.json(ok(await lireCircuits(validerFiltresCircuit(req.query))));
  }),
);

// Détail d'un circuit (étapes ordonnées).
routesCircuit.get(
  '/circuits/:id',
  asyncHandler(async (req, res) => {
    res.json(ok(await lireCircuit(parseCircuitId(exigerParam(req, 'id')))));
  }),
);

// Activité idéale par zone (?zone=).
routesCircuit.get(
  '/zones-activites',
  asyncHandler(async (req, res) => {
    const zone = typeof req.query.zone === 'string' ? req.query.zone : undefined;
    res.json(ok(await lireZonesActivites(zone)));
  }),
);
