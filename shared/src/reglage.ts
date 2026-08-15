// Contrat des RÉGLAGES (paramètres de composition / conduite / profils / médical), demandé par B (B111) pour câbler
// GET/PUT /api/reglages/:famille sur `budget.parametre`. Un réglage = une clé de paramètre exposée à l'UI, avec sa
// valeur, son défaut, ses bornes, et la CAPACITÉ requise pour l'éditer (gating par rôle/attribut). Le serveur (B) fait
// AUTORITÉ (refus de la mutation non habilitée) ; le client (C) s'en sert pour MONTRER ou verrouiller, sans réinventer.

import type { Capacite } from './role.js';

/**
 * Famille de réglage, alignée sur la capacité d'édition (cf `CAPACITE_PAR_FAMILLE`) :
 * - composition : ravitaillement, cadences laverie/confort, seuils confort, coût-nuit → organisateurs.
 * - conduite : cap roulage + fenêtres, transits, grandes étapes, autonomie → conducteurs (attribut + organisateur).
 * - profils : poids MCDA, signatures d'archétype → organisateur principal.
 * - medical : contraintes médicales d'un voyageur → PERSONNEL (édité par la personne, pas une capacité de rôle).
 */
export type FamilleReglage = 'composition' | 'conduite' | 'profils' | 'medical';

/** Type d'une valeur de réglage. */
export type ValeurReglage = number | string | boolean;

/** Bornes d'un réglage numérique : on ne peut pas régler HORS de ce cadre (les responsables fixent le cadre). */
export interface BornesReglage {
  min?: number;
  max?: number;
  /** Pas de saisie/curseur (ex. 0,5 h pour la durée de ravitaillement). */
  pas?: number;
}

/**
 * Un réglage exposé à l'UI. `capacite_requise` dit qui peut l'éditer (null pour `medical` = personnel, gardé par
 * l'appartenance côté serveur). `valeur_defaut` = le repli organisateur ; `bornes` = le cadre. C montre en lecture
 * seule si l'utilisateur n'a pas la capacité (ou n'est pas le propriétaire pour le médical).
 */
export interface Reglage {
  famille: FamilleReglage;
  cle: string;
  libelle?: string;
  valeur: ValeurReglage;
  valeur_defaut: ValeurReglage;
  bornes?: BornesReglage;
  unite?: string;
  /** Capacité requise pour éditer ; null = personnel (médical, édité par la personne). */
  capacite_requise: Capacite | null;
  /**
   * Écrans où ce paramètre est pertinent (B132, `budget.parametre_meta.ecran`) — pour l'overlay « ⚙ Réglages de cet
   * écran » (M343/C131) : l'overlay d'un écran X ne montre que les réglages dont `ecran ∋ X`. Absent = seulement dans
   * l'écran Régler global.
   */
  ecran?: string[];
}

/** Capacité requise par famille — source unique pour le gating (UI C + autorité serveur B). */
export const CAPACITE_PAR_FAMILLE: Record<FamilleReglage, Capacite | null> = {
  composition: 'regler_composition',
  conduite: 'regler_conduite',
  profils: 'regler_profils',
  medical: null,
};

/** PUT /api/reglages/:famille — écrire un réglage. PIN vérifié côté serveur (autorité), jamais stocké côté client. */
export interface DemandeEcrireReglage {
  cle: string;
  valeur: ValeurReglage;
  /** Preuve d'intention portée jusqu'au contrôle serveur (gaté capacité + bornes). */
  pin: string;
}
