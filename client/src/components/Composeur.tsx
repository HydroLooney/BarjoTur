import { useState } from 'react';
import type { Geometry } from 'geojson';
import type { ArretImpose, ComposeInput, ComposeReponse } from '@barjotur/shared';
import { useArchetypes, useComposer } from '@/lib/queries/composeur';
import { basesCandidatesDemo, composeReponseDemo } from '@/lib/fixtures/compose-demo';
import { transitDemo } from '@/lib/fixtures/voyage-demo';
import { CarteItineraire } from '@/components/CarteItineraire';
import { Badge } from '@/ui/primitives/badge';
import { Bouton } from '@/ui/primitives/button';
import { MessageErreur } from '@/ui/blocs/EtatVue';
import { NATURE_ETAPE } from '@/lib/libelles';
import { cn } from '@/lib/utils';

// Arrêts imposés du faisceau (épinglés / réservés) : contrainte dure poussée au calcul (M062). Depuis la
// fixture transit pour l'instant ; viendront de l'instance voyage live au flip.
const ARRETS_IMPOSES: ArretImpose[] = transitDemo
  .flatMap((e) => e.faisceau)
  .filter((a) => a.epingle)
  .map((a) => ({ lat: a.lat, lon: a.lon }));

// Coquille compose-launch (C-11 / M029), flip-ready. Formulaire `ComposeInput` (bases candidates + ambiance
// + agenda), appel du composeur derrière un DRAPEAU `live` : à false, on lit la fixture (contrat déjà typé,
// zéro invention) ; à true, appel réel de POST /compose. On bascule le drapeau à la montée de la stack
// (VITE_COMPOSE_LIVE=1, ou `?live` en DEV pour tester le branchement sans rebuild). Rendu strict de
// `ComposeReponse.geom`, comme la carte itinéraire.
const COMPOSE_LIVE_ENV = import.meta.env.VITE_COMPOSE_LIVE === '1';

export function Composeur() {
  const forceLive = import.meta.env.DEV && new URLSearchParams(window.location.search).has('live');
  const live = COMPOSE_LIVE_ENV || forceLive;

  const { data: archetypes } = useArchetypes();
  const composer = useComposer();

  const [bases, setBases] = useState<number[]>([]);
  const [archetypeKey, setArchetypeKey] = useState<string | null>(null);
  const [avecAgenda, setAvecAgenda] = useState(true);
  const [resultatDemo, setResultatDemo] = useState<ComposeReponse | null>(null);

  const basculerBase = (id: number) =>
    setBases((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const lancer = () => {
    const input: ComposeInput = {
      bases,
      archetype_key: archetypeKey,
      avec_agenda: avecAgenda,
      persister: false,
      arretsImposes: ARRETS_IMPOSES,
    };
    if (live) composer.mutate(input);
    else setResultatDemo(composeReponseDemo(input));
  };

  const peutComposer = bases.length > 0 && !composer.isPending;
  const resultat: ComposeReponse | null = live ? composer.data ?? null : resultatDemo;
  const geom: Geometry | null = (resultat?.geom as Geometry | undefined) ?? null;
  const meta = resultat?.compose;
  const erreurMetier = resultat && resultat.ok === false ? resultat.error ?? 'échec' : null;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium">L'expérience (la boucle)</h3>
        <p className="max-w-prose text-xs text-muted-foreground">
          Choisissez des bases et une ambiance, le moteur assemble un itinéraire et l'anime.
          {live ? '' : ' Aperçu de préparation (fixture) tant que le moteur n’est pas branché.'}
        </p>
      </div>

      {archetypes && archetypes.length > 0 ? (
        <fieldset className="space-y-1">
          <legend className="text-xs text-muted-foreground">Ambiance</legend>
          <div className="flex flex-wrap gap-2">
            {archetypes.map((a, i) => {
              const cle = a.archetype_key ?? a.key ?? String(i);
              const actif = archetypeKey === cle;
              return (
                <button
                  key={cle}
                  type="button"
                  aria-pressed={actif}
                  onClick={() => setArchetypeKey(actif ? null : cle)}
                  className={cn(
                    'rounded-md border px-3 py-2 text-sm transition-colors',
                    actif
                      ? 'border-primary bg-muted font-medium text-foreground'
                      : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {a.label ?? a.nom ?? cle}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <fieldset className="space-y-1">
        <legend className="text-xs text-muted-foreground">
          Bases candidates{bases.length > 0 ? ` (${bases.length} choisie${bases.length === 1 ? '' : 's'})` : ''}
        </legend>
        <div className="flex flex-wrap gap-2">
          {basesCandidatesDemo.map((b) => {
            const actif = bases.includes(b.base_id);
            return (
              <button
                key={b.base_id}
                type="button"
                aria-pressed={actif}
                onClick={() => basculerBase(b.base_id)}
                className={cn(
                  'rounded-md border px-3 py-2 text-sm transition-colors',
                  actif
                    ? 'border-primary bg-muted font-medium text-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {b.nom}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={avecAgenda} onChange={(e) => setAvecAgenda(e.target.checked)} className="h-4 w-4 accent-primary" />
        Calculer l'agenda jour par jour
      </label>

      <div className="flex items-center gap-3">
        <Bouton type="button" size="sm" onClick={lancer} disabled={!peutComposer}>
          {composer.isPending ? 'Composition en cours' : 'Composer'}
        </Bouton>
        {bases.length === 0 ? <span className="text-xs text-muted-foreground">Choisissez au moins une base.</span> : null}
      </div>

      {composer.isError ? <MessageErreur>La composition a échoué (service non joignable).</MessageErreur> : null}
      {erreurMetier ? <MessageErreur>Composition impossible : {erreurMetier}.</MessageErreur> : null}

      {geom ? (
        <div className="space-y-1">
          <CarteItineraire geom={geom} />
          {meta ? (
            <p className="text-xs text-muted-foreground">
              {meta.nuits} nuits · {meta.n_bases} bases · {Math.round(meta.drive_h)} h de route.
              {live ? '' : ' Tracé de démonstration (fixture).'}
            </p>
          ) : null}
        </div>
      ) : null}

      {resultat?.etapes && resultat.etapes.length > 0 ? (
        <div className="space-y-1">
          <h4 className="text-xs font-medium text-muted-foreground">La suite des étapes</h4>
          <ol className="space-y-1">
            {[...resultat.etapes]
              .sort((a, b) => a.ordre - b.ordre)
              .map((et) => (
                <li
                  key={et.ordre}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <span className="text-xs tabular-nums text-muted-foreground">{et.ordre}</span>
                  <Badge variant={et.nature === 'transit' ? 'neutre' : 'contour'}>
                    {et.nature === 'transit' ? NATURE_ETAPE.transit : NATURE_ETAPE.experience}
                  </Badge>
                  {et.statut === 'en_attente_corridor' ? (
                    <span className="text-xs text-muted-foreground">en attente du corridor</span>
                  ) : null}
                  {et.meta ? (
                    <span className="text-xs text-muted-foreground">
                      {et.meta.nuits} nuits · {Math.round(et.meta.drive_h)} h
                    </span>
                  ) : null}
                </li>
              ))}
          </ol>
          <p className="text-xs text-muted-foreground">
            La carte anime la boucle d'expérience ; les tracés de transit s'ajouteront avec le corridor.
          </p>
        </div>
      ) : null}
    </div>
  );
}
