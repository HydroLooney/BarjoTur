import type { BudgetComparatif } from '@barjotur/shared';
import { useBudgetComparatif } from '@/lib/queries/budget';
import { usePeut } from '@/hooks/usePeut';

// Vue budget (C-17 / intendance) : ventilation par poste + deux lectures (prudente / non prudente) +
// budget par adulte + alertes de plafond. Prévisionnel prudent, pas une cible (honnêteté R1).
const LIB_POSTE: Record<string, string> = {
  van: 'Van',
  activites: 'Activités',
  carburant: 'Carburant',
  hebergement: 'Hébergement',
  repas_courses: 'Repas et courses',
  ferry_interieur: 'Ferries intérieurs',
  ferry_international: 'Ferry international',
  transit: 'Transit (repositionnement)',
};

function euro(n: number): string {
  return `${Math.round(n).toLocaleString('fr-FR')} €`;
}

export function VueBudget() {
  // Financier nominatif détaillé (T043) : réservé aux capables (organisateurs, voyageurs adultes) ; masqué à
  // l'invité et, quand la qualification sera portée par whoami, à l'enfant. Autorité de fond côté serveur.
  const peutVoirBudget = usePeut('voir_budget_detaille');
  const { data } = useBudgetComparatif();
  const b: BudgetComparatif | undefined = data?.[0];
  if (!peutVoirBudget) return null;
  if (!b) return null;

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-medium">Budget{b.label ? ` (${b.label})` : ''}</h2>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <tbody>
            {Object.entries(b.postes).map(([cle, val]) => (
              <tr key={cle} className="border-t border-border first:border-t-0">
                <td className="px-3 py-2 text-muted-foreground">{LIB_POSTE[cle] ?? cle}</td>
                <td className="px-3 py-2 text-right tabular-nums">{euro(val)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span>
          Budget :{' '}
          <span className="font-medium tabular-nums">
            de {euro(b.total_non_prudent_eur)} à {euro(b.total_prudent_eur)}
          </span>
        </span>
        <span className="text-muted-foreground">estimation basse → haute</span>
      </div>
      <p className="text-xs text-muted-foreground tabular-nums">
        Par adulte ({b.par_adulte.nb_adultes}) : de {euro(b.par_adulte.non_prudent_eur)} à{' '}
        {euro(b.par_adulte.prudent_eur)}. {b.par_adulte.note}
      </p>
      {b.alertes.depasse_soft_prudent ? (
        <p className="text-xs text-destructive">
          Attention : l'estimation haute dépasse le plafond souple ({euro(b.alertes.soft_cap_eur)}).
        </p>
      ) : null}
    </div>
  );
}
