import { useState } from 'react';
import type { Circuit, DureeCircuit, ModeCircuit } from '@barjotur/shared';
import { usePeut } from '@/hooks/usePeut';
import { useCircuitAdopte } from '@/stores/circuit-adopte';
import { circuitsDemo } from '@/lib/fixtures/circuits-demo';
import { DUREE_CIRCUIT, MODE_CIRCUIT, filtrerCircuits, libelleDuree, zonesDisponibles } from '@/lib/circuits';
import { formatDuree } from '@/lib/budget-temps';
import { Bouton } from '@/ui/primitives/button';
import { cn } from '@/lib/utils';

// Bibliothèque de circuits tout-faits (M108) : des circuits de guide qu'on peut adopter comme point de départ,
// puis modifier de A à Z. Filtrable (zone, durée, mode d'origine). « Reprendre ce circuit » (gaté composer) le
// charge comme canevas ; l'itinéraire réel se re-route en van/rando au flip (côté A, gaté DSN). Source (guide +
// page) et mode d'origine affichés en clair. Fixture hors live ; forme d'écran figée pour le flip.
const SELECT =
  'h-11 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function BibliothequeCircuits() {
  const peutComposer = usePeut('composer');
  const [zone, setZone] = useState<string | null>(null);
  const [duree, setDuree] = useState<DureeCircuit | null>(null);
  const [mode, setMode] = useState<ModeCircuit | null>(null);
  const [ouvert, setOuvert] = useState<number | null>(null);

  const adopte = useCircuitAdopte((s) => s.circuit);
  const adopter = useCircuitAdopte((s) => s.adopter);
  const abandonner = useCircuitAdopte((s) => s.abandonner);
  const retirerEtape = useCircuitAdopte((s) => s.retirerEtape);

  const liste = filtrerCircuits(circuitsDemo, { zone, duree, mode });
  const zones = zonesDisponibles(circuitsDemo);

  return (
    <section className="space-y-3 rounded-lg border border-border p-3">
      <div>
        <h2 className="text-sm font-medium">Des circuits tout prêts</h2>
        <p className="max-w-prose text-xs text-muted-foreground">
          Des idées de circuits tirées des guides. Reprenez-en un comme point de départ, puis changez tout ce que vous
          voulez : ajouter, retirer, adapter à votre rythme. Le guide inspire, la famille tranche.
        </p>
      </div>

      {adopte ? (
        <div className="space-y-2 rounded-md border border-primary bg-muted p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium">Circuit repris : {adopte.nom}</p>
            <Bouton size="sm" variant="ghost" onClick={abandonner}>
              Abandonner
            </Bouton>
          </div>
          <p className="text-xs text-muted-foreground">
            À vous de l'adapter. L'itinéraire se recalculera pour le van quand la composition sera branchée.
          </p>
          <ol className="space-y-1">
            {adopte.etapes.map((e) => (
              <li key={e.ordre} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span>
                  {e.horaire ? <span className="tabular-nums text-muted-foreground">{e.horaire} · </span> : null}
                  {e.nom}
                  {e.duree_min != null ? (
                    <span className="text-muted-foreground"> ({formatDuree(e.duree_min)})</span>
                  ) : null}
                </span>
                <button
                  type="button"
                  onClick={() => retirerEtape(e.ordre)}
                  className="flex min-h-tactile items-center px-2 text-xs text-muted-foreground hover:text-foreground"
                  aria-label={`Retirer ${e.nom}`}
                >
                  retirer
                </button>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <select className={SELECT} value={zone ?? ''} onChange={(e) => setZone(e.target.value || null)} aria-label="Filtrer par zone">
          <option value="">Toutes les zones</option>
          {zones.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
        <select
          className={SELECT}
          value={duree ?? ''}
          onChange={(e) => setDuree((e.target.value || null) as DureeCircuit | null)}
          aria-label="Filtrer par durée"
        >
          <option value="">Toutes les durées</option>
          {(Object.keys(DUREE_CIRCUIT) as DureeCircuit[]).map((d) => (
            <option key={d} value={d}>
              {DUREE_CIRCUIT[d]}
            </option>
          ))}
        </select>
        <select
          className={SELECT}
          value={mode ?? ''}
          onChange={(e) => setMode((e.target.value || null) as ModeCircuit | null)}
          aria-label="Filtrer par mode d’origine"
        >
          <option value="">Tous les modes</option>
          {(Object.keys(MODE_CIRCUIT) as ModeCircuit[]).map((m) => (
            <option key={m} value={m}>
              {MODE_CIRCUIT[m]}
            </option>
          ))}
        </select>
      </div>

      {liste.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun circuit ne correspond à ces filtres.</p>
      ) : (
        <ul className="space-y-2">
          {liste.map((c) => (
            <CarteCircuit
              key={c.id ?? c.nom}
              circuit={c}
              ouvert={ouvert === (c.id ?? -1)}
              onBasculer={() => setOuvert(ouvert === (c.id ?? -1) ? null : (c.id ?? -1))}
              onReprendre={peutComposer ? () => adopter(c) : null}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function CarteCircuit({
  circuit: c,
  ouvert,
  onBasculer,
  onReprendre,
}: {
  circuit: Circuit;
  ouvert: boolean;
  onBasculer: () => void;
  onReprendre: (() => void) | null;
}) {
  return (
    <li className="rounded-md border border-border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{c.nom}</p>
        <span className="text-xs text-muted-foreground">
          {libelleDuree(c)} · {MODE_CIRCUIT[c.mode_origine]}
          {c.zone ? ` · ${c.zone}` : ''}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        D'après {c.source.guide}
        {c.source.page ? `, ${c.source.page}` : ''}
      </p>

      <div className="mt-2 flex flex-wrap gap-2">
        <Bouton size="sm" variant="outline" onClick={onBasculer} aria-expanded={ouvert}>
          {ouvert ? 'Masquer le détail' : 'Voir le détail'}
        </Bouton>
        {onReprendre ? (
          <Bouton size="sm" onClick={onReprendre}>
            Reprendre ce circuit
          </Bouton>
        ) : (
          <span className="flex items-center text-xs text-muted-foreground">Votre lien ne permet pas de composer.</span>
        )}
      </div>

      {ouvert ? (
        <div className="mt-2 space-y-2 border-t border-border pt-2">
          <ol className="space-y-1">
            {[...c.etapes]
              .sort((a, b) => a.ordre - b.ordre)
              .map((e) => (
                <li key={e.ordre} className="text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span>
                      {e.horaire ? <span className="tabular-nums text-muted-foreground">{e.horaire} · </span> : null}
                      {e.nom}
                    </span>
                    {e.duree_min != null ? (
                      <span className="text-xs text-muted-foreground">{formatDuree(e.duree_min)}</span>
                    ) : null}
                  </div>
                  {e.note ? <p className="text-xs text-muted-foreground">{e.note}</p> : null}
                </li>
              ))}
          </ol>
          {c.conseils && c.conseils.length > 0 ? (
            <p className={cn('text-xs text-muted-foreground')}>Conseils : {c.conseils.join(' · ')}.</p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
