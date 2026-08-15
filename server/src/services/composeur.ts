// Service composeur : pont entre le BFF et le sidecar Python (OR-Tools).
// Valide l'entrée, appelle le sidecar, écrit le fige via api.fige_enregistrer_systeme si demandé.
// Ne connaît pas Express (pas de req/res).
//
// Choix de conception :
//   - Si persister:true, on délègue entièrement au sidecar (persister=true dans ComposeReqSidecar)
//     afin que le sidecar gère la transaction fige de bout en bout (atomicité géom + etapes + commit).
//   - Si persister:false, on renvoie l'aperçu sans écriture en base.

import { Erreurs } from '../http/erreurs.js';
import { query } from '../db/query.js';
import { composerViaSidecar } from '../sidecar/client.js';
import { lirePhilosophie, profilVersSignature } from './philosophie.js';
import type { ComposeInput, ComposeReponse } from '../domain/composeur.js';
import type { SignatureComposeur } from '../domain/philosophie.js';

/**
 * Valide et normalise l'entrée du composeur. Lève une ErreurRequete si invalide.
 * M469 (parité v2) : `bases` absent ou vide ⇒ mode AUTO. Le champ vaut alors [] et
 * `composer` auto-remplit depuis le vivier ; l'utilisateur n'a jamais à choisir une base.
 * `bases` fourni non vide ⇒ mode manuel, chaque base_id doit être un entier strictement positif.
 */
export function validerComposeInput(corps: unknown): ComposeInput {
  if (typeof corps !== 'object' || corps === null || Array.isArray(corps)) {
    throw Erreurs.requeteInvalide('Le corps attendu est un objet JSON.');
  }
  const c = corps as Record<string, unknown>;

  let bases: number[] = [];
  if (c['bases'] !== undefined && c['bases'] !== null) {
    if (!Array.isArray(c['bases'])) {
      throw Erreurs.requeteInvalide('Le champ "bases", s\'il est fourni, doit être un tableau d\'entiers.');
    }
    const brut = c['bases'] as unknown[];
    if (!brut.every((b) => typeof b === 'number' && Number.isInteger(b) && b > 0)) {
      throw Erreurs.requeteInvalide('Chaque base_id doit être un entier strictement positif.');
    }
    bases = brut as number[];
  }

  const archetype_key =
    c['archetype_key'] === undefined || c['archetype_key'] === null
      ? null
      : typeof c['archetype_key'] === 'string'
        ? c['archetype_key']
        : (() => { throw Erreurs.requeteInvalide('"archetype_key" doit être une chaîne ou null.'); })();

  const avec_agenda = c['avec_agenda'] === undefined ? true : Boolean(c['avec_agenda']);
  const persister = c['persister'] === undefined ? false : Boolean(c['persister']);

  return { bases, archetype_key, avec_agenda, persister };
}

/**
 * Lit le vivier des bases candidates : toutes les bases que le sidecar sait scorer
 * (mcda2.base_reward_inputs, la même table que le solveur lit pour f1-6/reward). C'est la
 * liste des candidats, pas une valeur v2 dérivée — le solveur choisit ensuite le meilleur sous-ensemble.
 */
export async function lireVivierBases(): Promise<number[]> {
  const rows = await query<{ base_id: number }>(
    'SELECT base_id FROM mcda2.base_reward_inputs ORDER BY base_id',
  );
  return rows.map((r) => r.base_id);
}

/**
 * Résout les bases effectives. Mode manuel : on respecte les bases fournies. Mode auto (M469,
 * parité v2) : bases vide ⇒ on prend tout le vivier, l'utilisateur n'a jamais à choisir une base.
 * Le vivier est injectable pour les tests. Lève si le vivier est vide (rien à composer).
 */
export async function resoudreBases(
  bases: number[],
  lireVivier: () => Promise<number[]> = lireVivierBases,
): Promise<number[]> {
  if (bases.length > 0) return bases;
  const vivier = await lireVivier();
  if (vivier.length === 0) {
    throw Erreurs.requeteInvalide('Aucune base candidate disponible pour composer automatiquement.');
  }
  return vivier;
}

/**
 * Orchestre la composition : auto-remplit les bases si besoin (parité v2), puis délègue au sidecar
 * en lui transmettant les paramètres validés. Le sidecar gère OR-Tools, la géométrie (dont les ancres
 * ferry début+fin via _etape_depot), l'agenda 21 nuits et la persistance fige le cas échéant.
 */
export async function composer(input: ComposeInput, signature?: SignatureComposeur | null): Promise<ComposeReponse> {
  const bases = await resoudreBases(input.bases);
  const reponse = await composerViaSidecar({
    bases,
    archetype_key: input.archetype_key ?? null,
    signature: signature ?? null,
    avec_agenda: input.avec_agenda ?? true,
    avec_geom: true,
    persister: input.persister ?? false,
  });

  // Le sidecar peut répondre ok:false avec un message d'erreur métier (INFEASIBLE, archétype inconnu, etc.).
  // On laisse passer la réponse telle quelle : le client HTTP du front gère ok:false.
  return reponse;
}

/**
 * Compose « Mon voyage » (M513) : si un lien voyageur est fourni, on lit son profil philosophie et on en dérive la
 * signature d'objectif (profilVersSignature) passée au composeur. Sans lien, comportement inchangé (auto-compose neutre
 * ou archétype). Le leximin famille « Notre voyage » (N signatures) = v3.1 (M496).
 */
export async function composerAvecProfil(input: ComposeInput, code: string | null): Promise<ComposeReponse> {
  let signature: SignatureComposeur | null = null;
  if (code) {
    const philo = await lirePhilosophie(code);
    signature = profilVersSignature(philo.profil);
  }
  return composer(input, signature);
}
