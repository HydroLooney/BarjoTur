// Service budget vivant (#3, M547) : confronte 3 sources — marges expert + itinéraire composé + réservations réelles.
// Ne connaît pas Express. Lectures : budget_comparatif (prévisionnel + marges, RPC existante) + prepa.reservation (engagé,
// DB2, lecture directe). Total EUR-only ; NOK indicatif (C181). Suivi (dépenses vécues) = [] tant que non saisi (R1).
// ÉCRITURES (réservations/dépenses) = migration app-schema + gate + accord DIRECT Guillaume (DB2 précieux) — pas ici.

import { query } from '../db/query.js';
import { appelerRpc } from '../db/rpc.js';
import { margeEffectivePct } from '@barjotur/shared';
import type {
  BudgetVivant,
  BudgetPostes,
  BudgetComparatif,
  Reservation,
  StatutReservation,
  ReservationBrute,
} from '../domain/budget-vivant.js';

/** Taux indicatif NOK→EUR (affichage seulement ; le total reste EUR-only, C181). ~11,6 NOK/€. */
const TAUX_NOK_EUR = 0.086;

const POSTES_ZERO: BudgetPostes = {
  van: 0, activites: 0, carburant: 0, hebergement: 0, repas_courses: 0,
  ferry_interieur: 0, ferry_international: 0,
};

const STATUTS: readonly StatutReservation[] = ['pressenti', 'reserve', 'acompte', 'paye'];

/** Classe le type d'une réservation vers un poste budget (best-effort ; défaut hébergement). Pure. */
export function posteDeType(type: string | null): keyof BudgetPostes {
  const t = (type ?? '').toLowerCase();
  if (t.includes('ferry') && t.includes('inter')) return 'ferry_international';
  if (t.includes('ferry')) return 'ferry_interieur';
  if (t.includes('activ') || t.includes('excursion') || t.includes('kayak') || t.includes('croisi')) return 'activites';
  if (t.includes('carbur') || t.includes('diesel') || t.includes('essence')) return 'carburant';
  if (t.includes('peage') || t.includes('péage') || t.includes('bom')) return 'peages';
  if (t.includes('repas') || t.includes('course') || t.includes('resto')) return 'repas_courses';
  if (t.includes('van') || t.includes('location')) return 'van';
  return 'hebergement';
}

/** Normalise un statut brut vers le contrat (défaut pressenti). Pure. */
export function statutDe(s: string | null): StatutReservation {
  const v = (s ?? '').toLowerCase() as StatutReservation;
  return STATUTS.includes(v) ? v : 'pressenti';
}

/** Mappe une ligne prepa.reservation → Reservation (montant EUR-only, NOK indicatif si saisi ainsi). Pure. */
export function mapReservation(r: ReservationBrute): Reservation {
  const enNok = (r.devise ?? 'EUR').toUpperCase() === 'NOK';
  const montant = typeof r.montant === 'number' ? r.montant : 0;
  return {
    id: r.id,
    poste: posteDeType(r.type),
    libelle: r.libelle ?? r.type ?? 'Réservation',
    montant_eur: enNok ? Math.round(montant * TAUX_NOK_EUR * 100) / 100 : montant,
    montant_nok: enNok ? montant : null,
    statut: statutDe(r.statut),
    date: r.date_arr ?? null,
    note: r.note ?? null,
  };
}

/** Assemble le budget vivant à partir du comparatif prévisionnel + des réservations + des caps. Pure, testable. */
export function construireBudgetVivant(
  comp: BudgetComparatif | null,
  reservations: Reservation[],
  caps: { soft_cap_eur: number | null; hard_cap_eur: number | null },
): BudgetVivant {
  const postes = comp?.postes ?? POSTES_ZERO;
  const itineraireEur = comp?.total_non_prudent_eur ?? 0;
  const margesEur = comp?.total_prudent_eur ?? 0;
  const margePct = comp ? margeEffectivePct(comp) : null;
  const totalEngage = Math.round(reservations.reduce((s, r) => s + r.montant_eur, 0) * 100) / 100;

  return {
    postes,
    sources: [
      { source: 'marges_expert', montant_eur: margesEur, marge_pct: margePct },
      { source: 'itineraire', montant_eur: itineraireEur, marge_pct: null },
      { source: 'reservations', montant_eur: totalEngage, marge_pct: null },
    ],
    total_min_eur: itineraireEur,
    total_max_eur: margesEur,
    reservations,
    total_engage_eur: totalEngage,
    suivi: [],
    total_reel_eur: 0,
    reste_eur: Math.round((margesEur - totalEngage) * 100) / 100,
    soft_cap_eur: caps.soft_cap_eur,
    hard_cap_eur: caps.hard_cap_eur,
    devise: 'EUR',
  };
}

/** Lit les réservations réelles (prepa.reservation, DB2). Lecture directe (pas d'écriture). */
export async function lireReservations(): Promise<Reservation[]> {
  const rows = await query<ReservationBrute>(
    `SELECT id, type, libelle, to_char(date_arr,'YYYY-MM-DD') AS date_arr, statut, montant, devise, note
     FROM prepa.reservation ORDER BY date_arr NULLS LAST, id`,
  );
  return rows.map(mapReservation);
}

/**
 * Le budget vivant du voyage : comparatif prévisionnel (marges + itinéraire) confronté aux réservations engagées.
 * `code` réservé à un futur budget par-voyageur ; aujourd'hui le comparatif est familial. Champs non calculés = []/0 (R1).
 */
export async function lireBudgetVivant(_code: string): Promise<BudgetVivant> {
  const comparatifs = await appelerRpc<BudgetComparatif[]>('budget_comparatif', []).catch(() => []);
  const comp = comparatifs.find((c) => c.fige_id !== null) ?? comparatifs[0] ?? null;
  const reservations = await lireReservations();
  // Caps organisateurs : à brancher sur budget.parametre quand posés ; null d'ici là (R1).
  const caps = { soft_cap_eur: null, hard_cap_eur: null };
  return construireBudgetVivant(comp, reservations, caps);
}
