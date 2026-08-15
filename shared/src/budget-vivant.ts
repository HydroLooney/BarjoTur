// Contrat du BUDGET VIVANT (P0 #3), posé par M pour que B (endpoint) et C (rendu) se rencontrent. Compose avec budget.ts
// (réutilise BudgetPostes/BudgetComparatif). « Vivant » = 3 SOURCES explicites confrontées en continu : marges expert +
// itinéraire composé/tenu + réservations réelles. Additif. Réf. ROLES-DISTRIBUTION promesse #2. NOK↔€ = indicatif (C181).

import type { BudgetPostes } from './budget.js';

/** Une source du budget vivant (les 3 se somment / se confrontent). */
export type SourceBudget = 'marges_expert' | 'itineraire' | 'reservations';

/** Statut d'une réservation réelle (impacte le budget/comptes). */
export type StatutReservation = 'pressenti' | 'reserve' | 'acompte' | 'paye';

/** Une réservation réelle (waypoint figé → montant réel, écrase l'estimation du poste). */
export interface Reservation {
  id: number;
  poste: keyof BudgetPostes;
  libelle: string;
  montant_eur: number;
  /** Montant en couronnes si saisi ainsi (converti indicatif pour l'affichage ; le total reste EUR-only). */
  montant_nok?: number | null;
  statut: StatutReservation;
  /** Date ISO de la réservation / de l'échéance. */
  date?: string | null;
  note?: string | null;
}

/** Une dépense réelle saisie sur place (suivi vécu vs prévu). Écriture GATÉE (accord Guillaume au moment venu). */
export interface DepenseReelle {
  id: number;
  poste: keyof BudgetPostes;
  montant_eur: number;
  montant_nok?: number | null;
  date?: string | null;
  note?: string | null;
}

/** Le poids/état d'une source dans le budget vivant. */
export interface ApportSource {
  source: SourceBudget;
  /** Total € apporté/estimé par cette source. */
  montant_eur: number;
  /** Marge appliquée (%) le cas échéant (source marges_expert). */
  marge_pct?: number | null;
}

/** Le budget VIVANT complet : prévu (3 sources) confronté à l'engagé (réservations) + le réel (suivi), avec caps. */
export interface BudgetVivant {
  /** Postes prévisionnels (mêmes clés que budget.ts). */
  postes: BudgetPostes;
  /** Les 3 sources, explicites. */
  sources: ApportSource[];
  /** Fourchette prévisionnelle (marges basse→haute). */
  total_min_eur: number;
  total_max_eur: number;
  /** Réservations réelles (engagé) → écrasent l'estimation de leur poste. */
  reservations: Reservation[];
  total_engage_eur: number;
  /** Suivi réel (dépenses sur place), si le voyage a commencé. */
  suivi: DepenseReelle[];
  total_reel_eur: number;
  /** Reste à engager = total_max − engagé (indicatif). */
  reste_eur: number;
  /** Caps posés par les organisateurs (soft/hard), pour l'alerte. */
  soft_cap_eur?: number | null;
  hard_cap_eur?: number | null;
  /** Devise d'affichage courante ('EUR' par défaut ; conversion NOK indicative, C181). */
  devise: 'EUR' | 'NOK';
}

/** Corps d'écriture d'une réservation / dépense (PUT gaté capacité + accord Guillaume pour DB2). */
export interface BudgetVivantMajInput {
  reservation?: Omit<Reservation, 'id'> & { id?: number };
  depense?: Omit<DepenseReelle, 'id'> & { id?: number };
}
