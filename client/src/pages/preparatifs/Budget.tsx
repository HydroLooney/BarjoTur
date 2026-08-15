import { useEffect, useState } from 'react';
import type { BudgetVivant } from '@barjotur/shared';
import { useIdentite } from '@/stores/identite';
import { useBudgetVivant } from '@/lib/queries/budget-vivant';
import { VueBudgetVivant } from '@/components/VueBudgetVivant';
import { ConvertisseurCouronnes } from '@/components/ConvertisseurCouronnes';

// Sous-onglet « Budget » de Préparatifs (M543/M546) : le BUDGET VIVANT (#3, 3 sources confrontées + engagé + reste,
// gaté financier) et le convertisseur couronnes (outil famille non gaté). Se remplit dès le bff redéployé (B177) ;
// en DEV `?budget-vivant` charge un aperçu de structure (jamais en production, R1).
export default function PreparatifsBudget() {
  const code = useIdentite((s) => s.code);
  const { data } = useBudgetVivant(code);
  const [apercu, setApercu] = useState<BudgetVivant | null>(null);
  useEffect(() => {
    const veut = import.meta.env.DEV && new URLSearchParams(window.location.search).has('budget-vivant');
    if (veut && !data) void import('@/lib/fixtures/budget-vivant-demo').then((m) => setApercu(m.budgetVivantDemo));
  }, [data]);
  const budget = data ?? apercu;

  return (
    <div className="space-y-4">
      {budget ? <VueBudgetVivant budget={budget} /> : null}
      <ConvertisseurCouronnes />
    </div>
  );
}
