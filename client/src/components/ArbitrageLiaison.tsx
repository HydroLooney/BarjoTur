import { useMemo, useState } from 'react';
import {
  choisirVariante,
  coutCarburantEur,
  coutTotalEur,
  frontPareto,
  type ModeVariante,
} from '@barjotur/shared';
import { CurseurValeur } from '@/ui/primitives/curseur';
import { usePeut } from '@/hooks/usePeut';
import { useCarburant } from '@/stores/carburant';
import { formatDuree } from '@/lib/budget-temps';
import { liaisonDemoLibelle, variantesLiaisonDemo } from '@/lib/fixtures/arbitrage-demo';
import { cn } from '@/lib/utils';

// Arbitrage temps↔argent d'une liaison (M092 §3). Deux (ou trois) façons d'aller d'une base à l'autre : par le
// ferry (rapide, payant) ou par la route (long, gratuit). On montre temps + € par variante, on marque celles du
// front de Pareto (choix rationnels) et celle que la préférence de l'utilisateur retient (curseur argent↔temps).
// Le carburant se recompose à la volée depuis les curseurs carburant (km fixe) ; ferry et péage sont des tarifs.
// Budget détaillé → gaté `voir_budget_detaille`. Fixture hors live ; les vraies variantes viennent d'A (B040).
const MODE_LIBELLE: Record<ModeVariante, string> = {
  defaut: 'Par le ferry',
  sans_ferry: 'Par la route',
  sans_peage: 'Sans péage',
};

function euro(n: number): string {
  return `${Math.round(n).toLocaleString('fr-FR')} €`;
}

export function ArbitrageLiaison() {
  const peutVoirBudget = usePeut('voir_budget_detaille');
  const surconsoPct = useCarburant((s) => s.surconsoPct);
  const prixDiesel = useCarburant((s) => s.prixDiesel);
  const ristourneAutopassPct = useCarburant((s) => s.ristourneAutopassPct);
  // Préférence argent↔temps, en €/h : 0 = le moins cher, grand = le plus rapide.
  const [valeurTemps, setValeurTemps] = useState(10);

  // Recompose le carburant de chaque variante à la volée (le km est fixe ; seul le € bouge avec les curseurs).
  const variantes = useMemo(
    () =>
      variantesLiaisonDemo.map((v) => ({
        ...v,
        cout: {
          ...v.cout,
          carburant_eur: coutCarburantEur(v.km, surconsoPct, prixDiesel),
          // Ferry payé = plein × (1 − ristourne AutoPASS%) ; péage inchangé.
          ferry_eur: v.cout.ferry_eur * (1 - ristourneAutopassPct / 100),
        },
      })),
    [surconsoPct, prixDiesel, ristourneAutopassPct],
  );
  const pareto = useMemo(() => frontPareto(variantes), [variantes]);
  const choisie = useMemo(() => choisirVariante(variantes, valeurTemps), [variantes, valeurTemps]);

  if (!peutVoirBudget) return null;

  return (
    <section className="space-y-3 rounded-lg border border-border p-3">
      <div>
        <h2 className="text-sm font-medium">Ferry ou route ? {liaisonDemoLibelle}</h2>
        <p className="max-w-prose text-xs text-muted-foreground">
          Deux façons d'y aller. Réglez ce qui compte le plus pour vous, du moins cher au plus rapide, et voyez ce
          qu'on retient. (Exemple ; les vraies options viendront du calcul d'itinéraire.)
        </p>
      </div>

      <CurseurValeur
        label="Ce qui compte : argent et temps"
        valeur={valeurTemps}
        min={0}
        max={50}
        step={5}
        suffixe="€/h"
        onChange={setValeurTemps}
      />

      <ul className="space-y-2">
        {variantes.map((v) => {
          const total = coutTotalEur(v);
          const surPareto = pareto.includes(v);
          const estChoisie = v === choisie;
          return (
            <li
              key={v.mode}
              className={cn('rounded-md border p-3', estChoisie ? 'border-primary bg-muted' : 'border-border')}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{MODE_LIBELLE[v.mode]}</span>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {formatDuree(v.temps_min)} · {total > 0 ? euro(total) : 'gratuit'}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span>carburant {euro(v.cout.carburant_eur)}</span>
                {v.cout.ferry_eur > 0 ? <span>ferry {euro(v.cout.ferry_eur)}</span> : null}
                {v.cout.peage_eur > 0 ? <span>péage {euro(v.cout.peage_eur)}</span> : null}
                {estChoisie ? <span className="text-primary">votre choix</span> : null}
                {!surPareto ? <span>toujours battue par une autre</span> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
