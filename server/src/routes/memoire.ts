// Routes mémoire perso (B-17/B-18) : exploration sous /api/exploration/:code, collections sous
// /api/collection/:code/:cle (l'intendance = cle 'intendance', C-17). Minces, non gaté PIN, écritures idempotentes.
// Le backend est le sync/backup du MVP client-local (M022) : lecture ouverte au lien, écriture upsert.

import { Router } from 'express';
import { asyncHandler } from '../middleware/erreurs.js';
import { idempotence } from '../middleware/idempotence.js';
import { ok } from '../http/envelope.js';
import { exigerParam } from '../http/params.js';
import {
  validerMarque,
  validerContenu,
  lireExploration,
  marquerExploration,
  lireCollection,
  ecrireCollection,
} from '../services/memoire.js';

export const routesMemoire = Router();

// Mémoire d'exploration : liste des marques, puis upsert d'une marque (vu/exploré).
routesMemoire.get(
  '/exploration/:code',
  asyncHandler(async (req, res) => {
    res.json(ok(await lireExploration(exigerParam(req, 'code'))));
  }),
);

routesMemoire.post(
  '/exploration/:code',
  idempotence,
  asyncHandler(async (req, res) => {
    res.json(ok(await marquerExploration(exigerParam(req, 'code'), validerMarque(req.body))));
  }),
);

// Collections perso génériques (dont l'intendance) : lecture puis écriture d'un blob par clé.
routesMemoire.get(
  '/collection/:code/:cle',
  asyncHandler(async (req, res) => {
    res.json(ok(await lireCollection(exigerParam(req, 'code'), exigerParam(req, 'cle'))));
  }),
);

routesMemoire.put(
  '/collection/:code/:cle',
  idempotence,
  asyncHandler(async (req, res) => {
    res.json(ok(await ecrireCollection(exigerParam(req, 'code'), exigerParam(req, 'cle'), validerContenu(req.body))));
  }),
);
