import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useScenarioDefaut, useFigeDetail } from '@/lib/queries/fige';
import { FicheJour } from '@/components/FicheJour';
import { Chargement, MessageErreur, MessageVide } from '@/ui/blocs/EtatVue';

// Atlas imprimable (C-21) : toutes les fiches jour reliées, dans l'ordre du voyage, prêtes à imprimer
// ou exporter en PDF (impression navigateur). Une page par jour à l'impression (break-after-page).
// L'export = le PDF du navigateur ; pas de dépendance lourde côté client (A06).
export default function Atlas() {
  const { data: scenario, isLoading: chScenario, isError: errScenario } = useScenarioDefaut();
  const figeId = scenario?.fige_id ?? null;
  const { data: fige, isLoading: chFige, isError: errFige } = useFigeDetail(figeId);

  const etapes = useMemo(
    () => [...(fige?.etapes ?? [])].sort((a, b) => a.jour - b.jour),
    [fige],
  );

  const enChargement = chScenario || (figeId != null && chFige);
  const enErreur = errScenario || errFige;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 print:hidden">
        <Link to="/voyager" className="text-sm text-muted-foreground hover:text-foreground">
          ← Voyager
        </Link>
        {etapes.length > 0 ? (
          <button
            type="button"
            onClick={() => window.print()}
            className="min-h-tactile rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
          >
            Imprimer l'atlas
          </button>
        ) : null}
      </div>

      <header className="space-y-1">
        <h1 className="font-serif text-3xl">Atlas du voyage</h1>
        <p className="text-sm text-muted-foreground">
          {scenario?.label ? `${scenario.label}, ` : ''}
          {etapes.length > 0 ? `${etapes.length} jour${etapes.length === 1 ? '' : 's'}` : 'itinéraire retenu'}
        </p>
      </header>

      {enChargement && etapes.length === 0 ? <Chargement libelle="Chargement de l'atlas." /> : null}
      {enErreur && etapes.length === 0 ? (
        <MessageErreur>Atlas indisponible pour l'instant (le service n'est pas branché).</MessageErreur>
      ) : null}
      {!enChargement && !enErreur && etapes.length === 0 ? (
        <MessageVide>Aucune fiche jour dans l'itinéraire retenu.</MessageVide>
      ) : null}

      {etapes.length > 0 ? (
        <nav aria-label="Sommaire des jours" className="print:hidden">
          <ol className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {etapes.map((e) => (
              <li key={e.jour}>
                <Link
                  to={e.date_jour ? `/jour/${e.date_jour}` : '/atlas'}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Jour {e.jour}
                  {e.date_jour ? `, ${e.date_jour}` : ''}
                </Link>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      <div className="space-y-8">
        {etapes.map((e) => (
          <div
            key={e.jour}
            className="border-t border-border pt-6 first:border-t-0 first:pt-0 print:[&:not(:last-child)]:break-after-page"
          >
            <FicheJour etape={e} niveau={2} />
          </div>
        ))}
      </div>
    </section>
  );
}
