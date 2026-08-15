// Routes votes : minces. Elles valident la forme d'entrée superficielle, appellent le service, et emballent
// le résultat dans l'enveloppe ApiReponse. Aucun SQL ici, aucune règle métier (tout est dans services/votes).
// Identité = lien perso (`code`) dans l'URL. Voter n'est jamais gaté PIN (le PIN garde les corrections de POI).

import { Router } from 'express';
import { asyncHandler } from '../middleware/erreurs.js';
import { idempotence } from '../middleware/idempotence.js';
import { ok } from '../http/envelope.js';
import { exigerParam } from '../http/params.js';
import { Erreurs } from '../http/erreurs.js';
import {
  lireMesVotes,
  remplacerMesVotes,
  voterUnitaire,
  echangerVote,
  validerDemandeEchangeVote,
  lirePaniers,
  poserHorsBudget,
  validerDemandePoserHorsBudget,
  lireCascade,
  estTierValide,
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

// Échange ATOMIQUE de vote (M392) : retire + pose au même tier, en un seul appel (fin de la micro-fenêtre d'incohérence).
routesVotes.post(
  '/votes/:code/echanger',
  idempotence,
  asyncHandler(async (req, res) => {
    res.json(ok(await echangerVote(exigerParam(req, 'code'), validerDemandeEchangeVote(req.body))));
  }),
);

// État des paniers (M396) : ce qui est compté vs en surplus hors-budget, pour l'écran de classement + la notification.
routesVotes.get(
  '/votes/:code/paniers',
  asyncHandler(async (req, res) => {
    res.json(ok(await lirePaniers(exigerParam(req, 'code'))));
  }),
);

// Voie (b) « Régler plus tard » (M396) : pose le vote en surplus hors-budget du tier (NON compté jusqu'à résolution).
routesVotes.post(
  '/votes/:code/poser-hors-budget',
  idempotence,
  asyncHandler(async (req, res) => {
    res.json(ok(await poserHorsBudget(exigerParam(req, 'code'), validerDemandePoserHorsBudget(req.body))));
  }),
);

// Voie (a) « Rééquilibrer maintenant » (M396) : la suite finie d'étapes de déclassement pour faire de la place au tier.
routesVotes.get(
  '/votes/:code/cascade/:tier',
  asyncHandler(async (req, res) => {
    const tier = exigerParam(req, 'tier');
    if (!estTierValide(tier)) throw Erreurs.requeteInvalide(`Tier invalide : ${tier}.`);
    res.json(ok(await lireCascade(exigerParam(req, 'code'), tier)));
  }),
);
