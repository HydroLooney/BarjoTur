// Contrats budget vivant (#3, M547) : CANONIQUES dans @barjotur/shared (41903c8). Re-export + forme brute d'une ligne
// prepa.reservation (source « réservations réelles »). L'endpoint confronte 3 sources ; champs non calculés = null/[] (R1).

export type {
  BudgetVivant,
  SourceBudget,
  StatutReservation,
  Reservation,
  DepenseReelle,
  ApportSource,
  BudgetVivantMajInput,
} from '@barjotur/shared';
export type { BudgetPostes, BudgetComparatif } from '@barjotur/shared';

/** Ligne brute de prepa.reservation (DB2). Le montant est en `devise` ('EUR'|'NOK') ; le total budget reste EUR-only. */
export interface ReservationBrute {
  id: number;
  type: string | null;
  libelle: string | null;
  date_arr: string | null;
  statut: string | null;
  montant: number | null;
  devise: string | null;
  note: string | null;
}
