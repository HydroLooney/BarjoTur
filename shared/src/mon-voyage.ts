// Contrat « Mon voyage idéal » (P0, l'espace Mon voyage = mon idéal + mon écart au commun), posé par M. L'itinéraire
// composé pour le profil d'UN voyageur seul (son idéal), + son ÉCART au voyage commun (Notre Voyage). Réutilise
// ComposeReponse pour l'itinéraire. Additif. Réf. couple miroir Moi↔Nous (VALEURS-D-USAGE-v3).

import type { ComposeReponse } from './composeur.js';

/** L'écart entre le voyage idéal du voyageur et le voyage commun de la famille. */
export interface EcartAuCommun {
  /** Bases de l'itinéraire idéal du voyageur. */
  bases_ideal: number[];
  /** Bases du voyage commun (Notre Voyage). */
  bases_commun: number[];
  /** Bases présentes dans les deux (le voyageur est servi). */
  bases_partagees: number[];
  /** Bases que le voyageur aurait voulues et qui ne sont PAS dans le commun (son « sacrifice »). */
  bases_perso_seules: number[];
  /** Satisfaction du voyageur pour SON idéal, [0..1]. */
  satisfaction_ideal: number;
  /** Satisfaction du voyageur DANS le voyage commun, [0..1] (l'écart de satisfaction = idéal − commun). */
  satisfaction_dans_commun: number;
  /** Phrase honnête (R1), ex. « le voyage commun honore 6 de tes 8 coups de cœur ». */
  resume?: string | null;
}

/** L'espace « Mon voyage » : l'itinéraire idéal du voyageur (composé pour son seul profil) + son écart au commun. */
export interface MonVoyageIdeal {
  /** L'itinéraire idéal (composé avec la seule signature du voyageur) — même forme que le composeur. */
  ideal: ComposeReponse;
  /** L'écart au voyage commun (présent dès qu'un consensus existe ; null sinon). */
  ecart?: EcartAuCommun | null;
}
