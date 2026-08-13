// Service composeur : pont entre le BFF et le sidecar Python (OR-Tools).
// Valide l'entrée, appelle le sidecar, écrit le fige via api.fige_enregistrer_systeme si demandé.
// Ne connaît pas Express (pas de req/res).
//
// Choix de conception :
//   - Si persister:true, on délègue entièrement au sidecar (persister=true dans ComposeReqSidecar)
//     afin que le sidecar gère la transaction fige de bout en bout (atomicité géom + etapes + commit).
//   - Si persister:false, on renvoie l'aperçu sans écriture en base.

import { Erreurs } from '../http/erreurs.js';
import { composerViaSidecar } from '../sidecar/client.js';
import type { ComposeInput, ComposeReponse } from '../domain/composeur.js';

/** Valide et normalise l'entrée du composeur. Lève une ErreurRequete si invalide. */
export function validerComposeInput(corps: unknown): ComposeInput {
  if (typeof corps !== 'object' || corps === null || Array.isArray(corps)) {
    throw Erreurs.requeteInvalide('Le corps attendu est un objet JSON.');
  }
  const c = corps as Record<string, unknown>;

  if (!Array.isArray(c['bases']) || (c['bases'] as unknown[]).length === 0) {
    throw Erreurs.requeteInvalide('Le champ "bases" doit etre un tableau non vide d\'entiers.');
  }
  const bases = c['bases'] as unknown[];
  if (!bases.every((b) => typeof b === 'number' && Number.isInteger(b) && b > 0)) {
    throw Erreurs.requeteInvalide('Chaque base_id doit être un entier strictement positif.');
  }

  const archetype_key =
    c['archetype_key'] === undefined || c['archetype_key'] === null
      ? null
      : typeof c['archetype_key'] === 'string'
        ? c['archetype_key']
        : (() => { throw Erreurs.requeteInvalide('"archetype_key" doit être une chaîne ou null.'); })();

  const avec_agenda = c['avec_agenda'] === undefined ? true : Boolean(c['avec_agenda']);
  const persister = c['persister'] === undefined ? false : Boolean(c['persister']);

  return { bases: bases as number[], archetype_key, avec_agenda, persister };
}

/**
 * Orchestre la composition : délègue au sidecar en lui transmettant les paramètres validés.
 * Le sidecar gère OR-Tools, la géométrie, l'agenda et la persistance fige le cas échéant.
 */
export async function composer(input: ComposeInput): Promise<ComposeReponse> {
  const reponse = await composerViaSidecar({
    bases: input.bases,
    archetype_key: input.archetype_key ?? null,
    avec_agenda: input.avec_agenda ?? true,
    avec_geom: true,
    persister: input.persister ?? false,
  });

  // Le sidecar peut répondre ok:false avec un message d'erreur métier (INFEASIBLE, archétype inconnu, etc.).
  // On laisse passer la réponse telle quelle : le client HTTP du front gère ok:false.
  return reponse;
}
