// Route composeur : POST /api/composer.
// Mince : valide le corps, appelle le service, emballe le résultat.
// Le sidecar OR-Tools fait le travail lourd ; le BFF n'a qu'un rôle de portier.

import { Router } from 'express';
import { asyncHandler } from '../middleware/erreurs.js';
import { ok } from '../http/envelope.js';
import { validerComposeInput, composer } from '../services/composeur.js';

export const routesComposeur = Router();

/**
 * POST /api/composer
 *
 * Corps : ComposeInput (bases[], archetype_key?, avec_agenda?, persister?)
 * Réponse : ApiOk<ComposeReponse>
 *
 * Si persister:true, le sidecar écrit le fige en DB2 (api.fige_enregistrer_systeme).
 * Si persister:false (défaut), retourne un aperçu sans écriture.
 */
routesComposeur.post(
  '/composer',
  asyncHandler(async (req, res) => {
    const input = validerComposeInput(req.body as unknown);
    const reponse = await composer(input);
    res.json(ok(reponse));
  }),
);
