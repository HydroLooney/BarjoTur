// Contrats orphelins comblés après la review du cœur (REVIEW-coeur.md, 14/08) : l'écart à l'idéal (promesse centrale
// per-voyageur/collectif/fige), la densité des journées par voyageur + les bornes de sécurité communes, et l'étiquette
// de mise en avant d'un lieu. Décisions Guillaume : leximin par personne, densité par voyageur, mise en avant précalculée A.

import type { ResultatAllocation } from './allocation.js';

/**
 * L'itinéraire IDÉAL d'un voyageur : le résultat d'allocation calculé avec SES seuls poids (leximin dégénéré à une
 * personne), mémorisé comme référence. Sert à mesurer l'écart au voyage commun au fige.
 */
export interface IdealVoyageur {
  membre_id: number;
  resultat: ResultatAllocation;
}

/**
 * Écart d'un voyageur entre le voyage commun courant et son idéal : de combien il s'en éloigne, ce qu'il y gagne et ce
 * qu'il y cède. Affiché en direct au fige (« qui on avantage, qui on lèse, de combien »). `ecart` normalisé [0..1].
 */
export interface EcartIdeal {
  membre_id: number;
  ecart: number;
  /** Ce que le voyage commun apporte en plus de l'idéal (lieux/jours gagnés). */
  gagne: string[];
  /** Ce que le voyage commun retire par rapport à l'idéal (lieux/jours cédés). */
  cede: string[];
}

/**
 * Densité des journées d'un voyageur : 0 = journées légères (on prend le temps), 100 = journées denses (on enchaîne).
 * C'est une MOYENNE (le composeur alterne des journées denses et douces). Fusionnée en leximin pour le collectif.
 */
export interface Densite {
  membre_id: number;
  valeur: number;
}

/**
 * Bornes de sécurité COMMUNES au voyage (niveau collectif), qui protègent tout le monde, les enfants d'abord, et dans
 * lesquelles la densité de chacun s'exerce. La composition ne peut pas les violer, quelle que soit la densité choisie.
 */
export interface BornesSecurite {
  /** Plafond de temps « utile » d'une journée, en minutes (au-delà = journée épuisante). */
  plafond_jour_max_min: number;
  /** Heure au plus tard où l'on peut rouler (ex. « 19:00 »), pas de conduite tard le soir. */
  conduite_fin_max: string;
  /** Marge de temps minimale gardée dans chaque journée, en minutes. */
  marge_min: number;
  /** Impose une journée plus douce après une journée dense. */
  douce_apres_dense: boolean;
}

/**
 * Étiquette absolue de mise en avant d'un lieu (dérivée du reward + endossement guides, PRÉCALCULÉE par A) : trois crans,
 * ou rien en dessous. Le score continu de détour, lui, est calculé en live par le composeur (A24/A27).
 */
export type MiseEnAvant = 'vaut_le_voyage' | 'vaut_le_detour' | 'au_passage';
