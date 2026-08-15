// Route composeur : POST /api/composer.
// Mince : valide le corps, appelle le service, emballe le résultat.
// Le sidecar OR-Tools fait le travail lourd ; le BFF n'a qu'un rôle de portier.

import { Router } from 'express';
import { asyncHandler } from '../middleware/erreurs.js';
import { ok } from '../http/envelope.js';
import { validerComposeInput, composerAvecProfil } from '../services/composeur.js';

export const routesComposeur = Router();

/** Lit un lien voyageur (`code`) optionnel dans le corps : « Mon voyage » pondère par son profil philosophie (M513). */
function lireCodeVoyageur(corps: unknown): string | null {
  if (typeof corps === 'object' && corps !== null) {
    const code = (corps as Record<string, unknown>).code;
    if (typeof code === 'string' && code.length > 0) return code;
  }
  return null;
}

/**
 * POST /api/composer
 *
 * Corps : ComposeInput (bases[], archetype_key?, avec_agenda?, persister?) + `code?` (lien voyageur → Mon voyage).
 * Réponse : ApiOk<ComposeReponse>
 *
 * Si `code` est fourni, le composeur est pondéré par le profil philosophie du voyageur (signature inline, M513).
 * Si persister:true, le sidecar écrit le fige en DB2 ; sinon aperçu sans écriture.
 */
routesComposeur.post(
  '/composer',
  asyncHandler(async (req, res) => {
    const input = validerComposeInput(req.body as unknown);
    const code = lireCodeVoyageur(req.body as unknown);
    const reponse = await composerAvecProfil(input, code);
    res.json(ok(reponse));
  }),
);
