// Routes réglages (M361/M363 bloc 1) : GET liste (ouverte, C montre/verrouille selon capacite_requise) ; PUT écriture
// GATÉE capacité (demandeur résolu par whoami sur le :code, autorité serveur) + bornes/pin (RPC). Écriture DB2 en
// budget.parametre gatée « go bascule ». Minces : le métier vit dans domain/services.

import { Router } from 'express';
import { asyncHandler } from '../middleware/erreurs.js';
import { ok } from '../http/envelope.js';
import { exigerParam } from '../http/params.js';
import { validerFamille, validerDemandeEcrireReglage } from '../domain/reglage.js';
import { lireReglages, ecrireReglage } from '../services/reglage.js';
import { lireWhoami } from '../services/identite.js';

export const routesReglage = Router();

// Liste des réglages d'une famille (valeur + défaut + bornes + capacité requise).
routesReglage.get(
  '/reglages/:famille',
  asyncHandler(async (req, res) => {
    res.json(ok(await lireReglages(validerFamille(exigerParam(req, 'famille')))));
  }),
);

// Écrire un réglage : demandeur = :code (whoami → rôle/qualification/conducteur), corps { cle, valeur, pin }.
routesReglage.put(
  '/reglages/:code/:famille',
  asyncHandler(async (req, res) => {
    const famille = validerFamille(exigerParam(req, 'famille'));
    const code = exigerParam(req, 'code');
    const demande = validerDemandeEcrireReglage(req.body);
    const who = await lireWhoami(code);
    const ctx = {
      role: who.role,
      qualification: who.qualification,
      conducteur: who.conducteur, // typé (WhoamiResolu, M420/019) : plus de cast
    };
    res.json(ok(await ecrireReglage(famille, ctx, code, demande)));
  }),
);
