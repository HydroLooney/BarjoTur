// Contrat de l'AGENDA DU JOUR (carte du jour + agenda organisé), posé par le Maître (M526) pour que B (endpoint) et C
// (rendu) se rencontrent sans friction. Source = build_agenda du composeur, enrichi. Réf. docs/design/AGENDA-JOUR-BARRE-
// ANIMATION-NAV-v3.md (§2 contrainte horaire + budget temps + regroupements ; §3bis confort vécu). Additif.

/** Moment de la journée pour regrouper les activités (lisibilité, pas une liste plate). */
export type GroupeMoment = 'matin' | 'midi' | 'apres_midi' | 'soir';

/** Nature de la contrainte horaire d'une activité. `dure` = ancre non négociable (ferry, réservation). */
export type ContrainteHoraire = 'dure' | 'heure' | 'souple';

/** Type de nuit (confort vécu + coût-nuit cohérent avec le barème). */
export type TypeNuit = 'autonomie' | 'aire' | 'camping' | 'confort';

/** Densité ressentie du jour (jauge « souple ↔ soutenue », dépassement signalé R1). */
export type DensiteJour = 'souple' | 'modere' | 'soutenue' | 'depasse';

/** Une activité de l'agenda du jour (une ligne horodatée). */
export interface ActiviteAgenda {
  /** Heure d'ancrage « HH:MM » si connue (contrainte horaire) ; absent = souple dans son groupe. */
  heure?: string | null;
  /** Durée estimée en minutes (pour le budget-temps). */
  duree_min?: number | null;
  titre: string;
  sous_titre?: string | null;
  groupe_moment: GroupeMoment;
  /** `dure` (ferry/réservation/ouverture) se distingue visuellement des activités souples. */
  contrainte?: ContrainteHoraire;
  poi_id?: number | null;
  /** Activité payante (entre dans l'enveloppe d'activités confrontée au budget). */
  payant?: boolean;
  /** Coût indicatif en € si payante (par voyageur ou total, précisé par B). */
  cout_eur?: number | null;
}

/** Le confort vécu d'un jour (laverie, autonomie électrique/PPC, type de nuit + coût). Réf. AUDIT-v2 §4. */
export interface ConfortJour {
  /** Présence d'une laverie à l'étape. */
  laverie?: boolean;
  /** Jours depuis la dernière laverie / avant la prochaine (alerte douce si cadence dépassée). */
  laverie_jours_depuis?: number | null;
  laverie_jours_avant?: number | null;
  /** Longueur de la série de nuits autonomes en cours (alerte à l'approche de la borne PPC). */
  streak_autonomie?: number | null;
  /** Vrai si la série d'autonomie approche/atteint la borne PPC (contrainte électrique). */
  alerte_ppc?: boolean;
  type_nuit: TypeNuit;
  cout_nuit_eur?: number | null;
}

/** Un jour de l'itinéraire (la « carte du jour » de la barre d'animation). */
export interface JourAgenda {
  /** Rang du jour (1..N). */
  jour: number;
  /** Date ISO « YYYY-MM-DD ». */
  date?: string | null;
  base_id?: number | null;
  /** Nom du lieu/étape (titre de la carte du jour). */
  lieu?: string | null;
  /** Thème court (« le fjord classé, hors des heures de foule »). */
  theme?: string | null;
  /** Étape remarquable (badge « perle »). */
  perle?: boolean;
  lever?: string | null;
  coucher?: string | null;
  /** Budget-temps du jour en minutes (conduite + activités + marges). */
  budget_temps_min?: number | null;
  /** Temps effectivement consommé (pour confronter au budget → densité). */
  temps_consomme_min?: number | null;
  densite?: DensiteJour;
  /** Activités regroupées (l'ordre suit heure puis groupe_moment). */
  activites: ActiviteAgenda[];
  confort: ConfortJour;
}

/** L'agenda complet du voyage (rendu par la barre d'animation + la carte du jour). */
export interface AgendaVoyage {
  jours: JourAgenda[];
  /** Ancres de bornes (départ/retour, ferry) pour la timeline. */
  ancre_depart?: string | null;
  ancre_retour?: string | null;
  /** Budget-temps total agrégé (minutes) si calculé. */
  budget_temps_total_min?: number | null;
}

/** Les groupes de moment dans l'ordre d'affichage. */
export const GROUPES_MOMENT: readonly GroupeMoment[] = ['matin', 'midi', 'apres_midi', 'soir'];
