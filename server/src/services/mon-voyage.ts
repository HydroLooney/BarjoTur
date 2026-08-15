// Service « Mon voyage idéal » (P0, M554) : l'itinéraire composé pour la SEULE signature du voyageur (son idéal), + son
// écart au voyage commun (Notre Voyage). Ne connaît pas Express. Réutilise composerAvecProfil (Mon voyage, pondéré profil).
// L'écart au commun exige un consensus figé leximin (v3.1) → null tant qu'il n'existe pas (R1). Contrat = shared 5106fd2.

import { composerAvecProfil } from './composeur.js';
import type { MonVoyageIdeal } from '@barjotur/shared';

/**
 * L'idéal du voyageur porteur du lien : composition pondérée par son seul profil philosophie. `ecart` au voyage commun =
 * null tant que le consensus égalitaire (leximin) n'est pas calculé (v3.1) — l'endpoint reste honnête (R1), C rend l'idéal.
 */
export async function lireMonVoyage(code: string): Promise<MonVoyageIdeal> {
  const ideal = await composerAvecProfil(
    { bases: [], archetype_key: null, avec_agenda: false, persister: false },
    code,
  );
  return { ideal, ecart: null };
}
