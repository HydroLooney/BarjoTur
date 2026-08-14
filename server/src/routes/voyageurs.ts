// Routes admin des voyageurs (T039, M074/M077) : lire la tribu, changer un rôle, régénérer un lien. Minces.
// Le rôle du DEMANDEUR est résolu par whoami depuis le `code` (dans le path, convention app `/app/<code>/`, comme
// /exploration/:code) ; l'autorité serveur applique la capacité `administrer_voyageurs` (carte partagée `peut`, M077).
// Les corps sont EXACTEMENT les contrats partagés DemandeRole/DemandeRegenererLien (membre_id de la cible = path).
// Mutations gatées PIN côté RPC (autorité serveur) et idempotentes. Données PRÉCIEUSES (hors sync B-15).
// Persistance DB2 câblée au flip (RPC api.voyageur*, migration 007). Forme de route à confirmer par M (B041).

import { Router } from 'express';
import { asyncHandler } from '../middleware/erreurs.js';
import { idempotence } from '../middleware/idempotence.js';
import { ok } from '../http/envelope.js';
import { exigerParam } from '../http/params.js';
import {
  parseVoyageId,
  validerDemandeRole,
  validerDemandeRegenererLien,
  lireVoyageurs,
  changerRole,
  regenererLien,
} from '../services/voyageurs.js';

export const routesVoyageurs = Router();

// Liste de la tribu (capacité administrer_voyageurs). Lien du demandeur dans le path.
routesVoyageurs.get(
  '/voyageurs/:voyage_id/:code',
  asyncHandler(async (req, res) => {
    const voyageId = parseVoyageId(exigerParam(req, 'voyage_id'));
    res.json(ok(await lireVoyageurs(voyageId, exigerParam(req, 'code'))));
  }),
);

// Changer le rôle d'un voyageur cible. Demandeur = :code (path), cible = :membre_id (path), corps { role, pin }.
routesVoyageurs.put(
  '/voyageurs/:voyage_id/:code/:membre_id/role',
  idempotence,
  asyncHandler(async (req, res) => {
    const voyageId = parseVoyageId(exigerParam(req, 'voyage_id'));
    const membre_id = Number(exigerParam(req, 'membre_id'));
    const demande = validerDemandeRole({ ...(req.body as object), membre_id });
    res.json(ok(await changerRole(voyageId, exigerParam(req, 'code'), demande)));
  }),
);

// Régénérer le lien perso d'un voyageur cible (nouveau code, ancien invalidé). Corps { pin }.
routesVoyageurs.post(
  '/voyageurs/:voyage_id/:code/:membre_id/regenerer-lien',
  idempotence,
  asyncHandler(async (req, res) => {
    const voyageId = parseVoyageId(exigerParam(req, 'voyage_id'));
    const membre_id = Number(exigerParam(req, 'membre_id'));
    const demande = validerDemandeRegenererLien({ ...(req.body as object), membre_id });
    res.json(ok(await regenererLien(voyageId, exigerParam(req, 'code'), demande)));
  }),
);
