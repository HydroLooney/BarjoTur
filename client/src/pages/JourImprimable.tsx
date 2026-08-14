import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useScenarioDefaut, useFigeDetail } from '@/lib/queries/fige';
import { FicheJour } from '@/components/FicheJour';

// Fiche jour imprimable (C12) : la page d'un jour du voyage, tirée des étapes du fige (scenario par
// défaut), pensée pour l'impression (window.print, variantes Tailwind print:). L'atlas (toutes les
// fiches) viendra en index.
export default function JourImprimable() {
  const { date } = useParams<{ date: string }>();
  const { data: scenario } = useScenarioDefaut();
  const { data: fige } = useFigeDetail(scenario?.fige_id ?? null);
  const etape = useMemo(() => fige?.etapes.find((e) => e.date_jour === date) ?? null, [fige, date]);

  if (!etape) {
    return (
      <section className="space-y-3">
        <p className="text-muted-foreground">Aucune fiche jour pour cette date.</p>
        <Link to="/voyager" className="text-sm underline">
          Retour à Voyager
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-4 print:hidden">
        <Link to="/voyager" className="text-sm text-muted-foreground hover:text-foreground">
          ← Voyager
        </Link>
        <Link to="/atlas" className="text-sm text-muted-foreground hover:text-foreground">
          Atlas complet
        </Link>
      </div>

      <FicheJour etape={etape} niveau={1} />

      <div className="print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="min-h-tactile rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
        >
          Imprimer cette fiche
        </button>
      </div>
    </section>
  );
}
