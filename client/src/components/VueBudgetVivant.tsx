import type { BudgetVivant, SourceBudget, StatutReservation } from '@barjotur/shared';
import { usePeut } from '@/hooks/usePeut';

// BUDGET VIVANT (#3, contrat 41903c8) : le prévisionnel « vivant » = 3 SOURCES confrontées (marges expert +
// itinéraire + réservations réelles), la fourchette basse→haute, ce qui est DÉJÀ engagé (réservations, par statut) et
// le RESTE à engager, avec l'alerte de plafond. Financier nominatif → gaté `voir_budget_detaille`. Prévisionnel
// prudent, pas une cible (R1). Le suivi des dépenses vécues arrive quand le voyage commence (écriture gatée, DB2).

const LIB_POSTE: Record<string, string> = {
  van: 'Van',
  activites: 'Activités',
  carburant: 'Carburant',
  hebergement: 'Hébergement',
  repas_courses: 'Repas et courses',
  ferry_interieur: 'Ferries intérieurs',
  ferry_international: 'Ferry international',
  peages: 'Péages',
  transit: 'Transit',
};

const LIB_SOURCE: Record<SourceBudget, string> = {
  marges_expert: 'Estimation prudente (avec marges)',
  itineraire: 'Selon l’itinéraire tenu',
  reservations: 'Réservations engagées',
};

const LIB_STATUT: Record<StatutReservation, string> = {
  pressenti: 'Pressenti',
  reserve: 'Réservé',
  acompte: 'Acompte versé',
  paye: 'Payé',
};

function euro(n: number): string {
  return `${Math.round(n).toLocaleString('fr-FR')} €`;
}

export function VueBudgetVivant({ budget }: { budget: BudgetVivant }) {
  const peutVoir = usePeut('voir_budget_detaille');
  if (!peutVoir) return null;

  const depasseSoft = budget.soft_cap_eur != null && budget.total_max_eur > budget.soft_cap_eur;
  const depasseHard = budget.hard_cap_eur != null && budget.total_max_eur > budget.hard_cap_eur;

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-posee">
      <div className="space-y-1">
        <h2 className="font-serif text-xl">Le budget, en vrai</h2>
        <p className="text-sm text-muted-foreground">
          Trois façons de le regarder, confrontées : l’estimation prudente, ce que coûte l’itinéraire, et ce qui est
          déjà réservé. Prévisionnel prudent, pas une cible.
        </p>
      </div>

      {/* Fourchette prévisionnelle basse → haute. */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-2xl font-semibold tabular-nums">
          {euro(budget.total_min_eur)} <span className="text-muted-foreground">à</span> {euro(budget.total_max_eur)}
        </span>
        <span className="text-xs text-muted-foreground">estimation basse → haute</span>
      </div>

      {/* Les 3 sources, explicites. */}
      <div className="space-y-1">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Les trois regards</h3>
        <ul className="divide-y divide-border">
          {budget.sources.map((s) => (
            <li key={s.source} className="flex items-center justify-between gap-2 py-1.5 text-sm">
              <span>
                {LIB_SOURCE[s.source]}
                {s.marge_pct != null ? (
                  <span className="text-muted-foreground"> · marge {Math.round(s.marge_pct)} %</span>
                ) : null}
              </span>
              <span className="tabular-nums">{euro(s.montant_eur)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Ventilation par poste. */}
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <tbody>
            {Object.entries(budget.postes)
              .filter(([, v]) => v != null)
              .map(([cle, val]) => (
                <tr key={cle} className="border-t border-border first:border-t-0">
                  <td className="px-3 py-2 text-muted-foreground">{LIB_POSTE[cle] ?? cle}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{euro(val as number)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Engagé : les réservations réelles, par statut. */}
      <div className="space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Déjà engagé</h3>
          <span className="text-sm tabular-nums">
            {euro(budget.total_engage_eur)} <span className="text-muted-foreground">engagés</span>
          </span>
        </div>
        {budget.reservations.length > 0 ? (
          <ul className="divide-y divide-border">
            {budget.reservations.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 py-1.5 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {r.libelle}
                  <span className="text-muted-foreground"> · {LIB_POSTE[r.poste] ?? r.poste}</span>
                </span>
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {LIB_STATUT[r.statut]}
                </span>
                <span className="tabular-nums">
                  {euro(r.montant_eur)}
                  {r.montant_nok != null ? (
                    <span className="text-xs text-muted-foreground"> ({Math.round(r.montant_nok).toLocaleString('fr-FR')} kr)</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Rien d’engagé pour l’instant.</p>
        )}
      </div>

      {/* Reste à engager + caps. */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
        <span className="text-muted-foreground">Reste à engager (indicatif)</span>
        <span className="font-medium tabular-nums">{euro(budget.reste_eur)}</span>
      </div>

      {depasseHard ? (
        <p className="text-sm" style={{ color: 'var(--destructive)' }}>
          L’estimation haute dépasse le plafond maximum ({euro(budget.hard_cap_eur as number)}).
        </p>
      ) : depasseSoft ? (
        <p className="text-sm" style={{ color: 'var(--destructive)' }}>
          L’estimation haute dépasse le plafond souple ({euro(budget.soft_cap_eur as number)}).
        </p>
      ) : null}

      {/* Suivi réel (à venir). */}
      {budget.suivi.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Le suivi des dépenses réelles apparaîtra ici une fois le voyage commencé.
        </p>
      ) : null}
    </section>
  );
}
