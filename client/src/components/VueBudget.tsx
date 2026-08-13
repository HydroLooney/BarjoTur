import type { BudgetComparatif } from '@barjotur/shared';
import { useBudgetComparatif } from '@/lib/queries/budget';

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
};

function euro(n: number): string {
  return `${Math.round(n).toLocaleString('fr-FR')} €`;
}

export function VueBudget() {
  const { data } = useBudgetComparatif();
  const b: BudgetComparatif | undefined = data?.[0];
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
          Total prudent : <span className="font-medium">{euro(b.total_prudent_eur)}</span>
        </span>
        <span className="text-muted-foreground">Non prudent : {euro(b.total_non_prudent_eur)}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Par adulte ({b.par_adulte.nb_adultes}) : {euro(b.par_adulte.prudent_eur)} prudent,{' '}
        {euro(b.par_adulte.non_prudent_eur)} non prudent. {b.par_adulte.note}
      </p>
      {b.alertes.depasse_soft_prudent ? (
        <p className="text-xs text-rouge">
          Alerte : le prévisionnel prudent dépasse le plafond souple ({euro(b.alertes.soft_cap_eur)}).
        </p>
      ) : null}
    </div>
  );
}
