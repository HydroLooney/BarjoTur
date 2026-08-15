// Routes philosophie de voyage (M508) : lire le catalogue + le profil d'un voyageur, l'écrire (versionné). Le voyageur
// est identifié par son lien (`:code`). Lecture ouverte au lien ; écriture gatée capacité `voter` (dans le service) +
// idempotente. Contrat = shared 3c46a57 ; source unique DB2 (decision.philosophie_*, migration 020).

import { Router } from 'express';
import { asyncHandler } from '../middleware/erreurs.js';
import { idempotence } from '../middleware/idempotence.js';
import { ok } from '../http/envelope.js';
import { exigerParam } from '../http/params.js';
import { lirePhilosophie, ecrirePhilosophie, validerMajProfil } from '../services/philosophie.js';

export const routesPhilosophie = Router();

routesPhilosophie.get(
  '/philosophie/:code',
  asyncHandler(async (req, res) => {
    res.json(ok(await lirePhilosophie(exigerParam(req, 'code'))));
  }),
);

routesPhilosophie.put(
  '/philosophie/:code',
  idempotence,
  asyncHandler(async (req, res) => {
    res.json(ok(await ecrirePhilosophie(exigerParam(req, 'code'), validerMajProfil(req.body))));
  }),
);
