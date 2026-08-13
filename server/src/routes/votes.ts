// Routes votes : minces. Elles valident la forme d'entrée superficielle, appellent le service, et emballent
// le résultat dans l'enveloppe ApiReponse. Aucun SQL ici, aucune règle métier (tout est dans services/votes).
// Identité = lien perso (`code`) dans l'URL. Voter n'est jamais gaté PIN (le PIN garde les corrections de POI).

import { Router } from 'express';
import { asyncHandler } from '../middleware/erreurs.js';
import { idempotence } from '../middleware/idempotence.js';
import { ok } from '../http/envelope.js';
import { exigerParam } from '../http/params.js';
import {
  lireMesVotes,
  remplacerMesVotes,
  voterUnitaire,
  lireConsensusParBase,
} from '../services/votes.js';

export const routesVotes = Router();

// Consensus par base : défini avant `/votes/:code` pour ne pas être capté comme un code.
routesVotes.get(
  '/votes/consensus/bases',
  asyncHandler(async (_req, res) => {
    res.json(ok(await lireConsensusParBase()));
  }),
);

// Mes votes (lecture).
routesVotes.get(
  '/votes/:code',
  asyncHandler(async (req, res) => {
    res.json(ok(await lireMesVotes(exigerParam(req, 'code'))));
  }),
);

// Remplacement complet de mes votes.
routesVotes.put(
  '/votes/:code',
  idempotence,
  asyncHandler(async (req, res) => {
    res.json(ok(await remplacerMesVotes(exigerParam(req, 'code'), req.body)));
  }),
);

// Vote unitaire (pose ou retrait), sans toucher aux autres.
routesVotes.post(
  '/votes/:code/unitaire',
  idempotence,
  asyncHandler(async (req, res) => {
    res.json(ok(await voterUnitaire(exigerParam(req, 'code'), req.body)));
  }),
);
