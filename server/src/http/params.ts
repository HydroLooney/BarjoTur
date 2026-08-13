// Extraction sûre d'un paramètre d'URL. Avec noUncheckedIndexedAccess, req.params.x est `string | undefined` ;
// ce garde-fou rend une chaîne certaine ou lève une 400 explicite (jamais un « undefined » silencieux).

import type { Request } from 'express';
import { Erreurs } from './erreurs.js';

export function exigerParam(req: Request, nom: string): string {
  const v = req.params[nom];
  if (v === undefined || v === '') {
    throw Erreurs.requeteInvalide(`Paramètre d'URL manquant : ${nom}.`);
  }
  return v;
}
