import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useScenarioDefaut, useFigeDetail } from '@/lib/queries/fige';
import { figeDetailDemo, scenarioDemo } from '@/lib/fixtures/fige-demo';
import { FicheJour } from '@/components/FicheJour';

// Atlas imprimable (C-21 / M103) : le voyage sur papier, toutes les fiches jour reliées dans l'ordre, prêtes
// à imprimer ou enregistrer en PDF (impression navigateur), une page par jour (break-after-page). De quoi
// garder le voyage en main sans réseau. Flip-ready : hors live, la fixture (figeDetailDemo) alimente l'atlas ;
// au flip, la compo retenue et le budget-jour de B fournissent les vraies étapes, la forme ne bouge pas.
export default function Atlas() {
  const { data: scenarioLive } = useScenarioDefaut();
  const figeId = scenarioLive?.fige_id ?? null;
  const { data: figeLive } = useFigeDetail(figeId);

  const surDemo = !figeLive;
  const scenario = scenarioLive ?? scenarioDemo;
  const fige = figeLive ?? figeDetailDemo;

  const etapes = useMemo(() => [...fige.etapes].sort((a, b) => a.jour - b.jour), [fige]);
  // Aller / retour (carte animée M218, sous-brique 3 — cohérent tracé/fil/atlas) : bascule à l'apex (au flip =
  // apex du modèle d'anim via la vraie ancre ; en démo, milieu du voyage). Mêmes jetons que le tracé et le fil.
  const jApex = useMemo(() => Math.ceil(etapes.length / 2), [etapes]);
  const aller = useMemo(() => etapes.filter((e) => e.jour <= jApex), [etapes, jApex]);
  const retour = useMemo(() => etapes.filter((e) => e.jour > jApex), [etapes, jApex]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 print:hidden">
        <Link to="/preparatifs" className="text-sm text-muted-foreground hover:text-foreground">
          ← Préparatifs
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
          {scenario.label ? `${scenario.label}, ` : ''}
          {etapes.length > 0 ? `${etapes.length} jour${etapes.length === 1 ? '' : 's'}` : 'itinéraire retenu'}
        </p>
        {surDemo ? (
          <p className="text-xs text-muted-foreground print:hidden">
            Exemple, pour montrer la forme des pages. Le vrai voyage s'affichera quand la composition sera calculée.
          </p>
        ) : null}
      </header>

      {etapes.length > 0 ? (
        <nav aria-label="Sommaire des jours" className="print:hidden">
          <ol className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {etapes.map((e) => (
              <li key={e.jour}>
                <Link
                  to={e.date_jour ? `/jour/${e.date_jour}` : '/atlas'}
                  className="flex min-h-tactile items-center text-sm text-muted-foreground hover:text-foreground"
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
        {[
          { cle: 'aller', titre: 'Aller', couleur: 'var(--fil-aller)', jours: aller },
          { cle: 'retour', titre: 'Retour', couleur: 'var(--fil-retour)', jours: retour },
        ]
          .filter((s) => s.jours.length > 0)
          .map((s) => (
            <div key={s.cle} className="space-y-8">
              {/* En-tête de section aller/retour : couleur franche, cohérente avec le tracé et le fil. */}
              <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                <span aria-hidden className="inline-block h-2.5 w-8 rounded-full" style={{ backgroundColor: s.couleur }} />
                {s.titre}
              </p>
              {s.jours.map((e) => (
                <div
                  key={e.jour}
                  className="border-l-2 pl-4 pt-1 print:[&:not(:last-child)]:break-after-page"
                  style={{ borderColor: s.couleur }}
                >
                  <FicheJour etape={e} niveau={2} />
                </div>
              ))}
            </div>
          ))}
      </div>
    </section>
  );
}
