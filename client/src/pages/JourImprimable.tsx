import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useScenarioDefaut, useFigeDetail } from '@/lib/queries/fige';

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
      <div className="print:hidden">
        <Link to="/voyager" className="text-sm text-muted-foreground hover:text-foreground">
          ← Voyager
        </Link>
      </div>

      <header className="space-y-1">
        <h1 className="font-serif text-2xl">
          Jour {etape.jour}
          {etape.date_jour ? `, ${etape.date_jour}` : ''}
        </h1>
        {etape.nuitee_type ? <p className="text-sm text-muted-foreground">Nuitée : {etape.nuitee_type}</p> : null}
      </header>

      <dl className="grid gap-3 sm:grid-cols-2">
        {etape.roulage_min != null ? (
          <div>
            <dt className="text-xs text-muted-foreground">Roulage</dt>
            <dd>{etape.roulage_min} min</dd>
          </div>
        ) : null}
        {etape.lever || etape.coucher ? (
          <div>
            <dt className="text-xs text-muted-foreground">Lever / coucher</dt>
            <dd>
              {etape.lever ?? '·'} / {etape.coucher ?? '·'}
            </dd>
          </div>
        ) : null}
        {etape.tier_jour ? (
          <div>
            <dt className="text-xs text-muted-foreground">Tier du jour</dt>
            <dd>{etape.tier_jour}</dd>
          </div>
        ) : null}
        {etape.meteo_dependant != null ? (
          <div>
            <dt className="text-xs text-muted-foreground">Météo-dépendant</dt>
            <dd>{etape.meteo_dependant ? 'oui' : 'non'}</dd>
          </div>
        ) : null}
        {etape.poi_osm_ids && etape.poi_osm_ids.length > 0 ? (
          <div>
            <dt className="text-xs text-muted-foreground">Lieux du jour</dt>
            <dd>{etape.poi_osm_ids.length}</dd>
          </div>
        ) : null}
      </dl>

      {etape.note ? <p className="max-w-prose text-sm text-muted-foreground">{etape.note}</p> : null}

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
