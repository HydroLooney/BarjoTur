import { useEffect, useState } from 'react';
import type { Geometry, MultiLineString } from 'geojson';
import { useArchetypes, useComposer } from '@/lib/queries/composeur';
import { CarteItineraire } from '@/components/CarteItineraire';
import { Bouton } from '@/ui/primitives/button';
import { MessageErreur } from '@/ui/blocs/EtatVue';
import { cn } from '@/lib/utils';

// Composeur (C-11) : choisir une ambiance (archétype) puis composer un itinéraire, et ANIMER le résultat
// avec la même brique carte (rendu strict de `ComposeReponse.geom`). Le lancement du calcul (sélection des
// bases candidates + sidecar OR-Tools) se branche à la bascule ; ici on câble la sélection et l'animation
// du résultat. Honnêteté R1 : tant que le sidecar n'est pas branché, l'aperçu `?demo` est étiqueté factice.
export function Composeur() {
  const { data: archetypes } = useArchetypes();
  const composer = useComposer();
  const [archetypeKey, setArchetypeKey] = useState<string | null>(null);

  // DEV ?demo : anime un tracé factice pour démontrer l'animation du résultat hors sidecar.
  const [demoGeom, setDemoGeom] = useState<MultiLineString | null>(null);
  useEffect(() => {
    const demo = import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo');
    if (demo) void import('@/lib/fixtures/fige-demo').then((m) => setDemoGeom(m.figeGeomDemo));
  }, []);

  const resultat = composer.data;
  const geom: Geometry | null = (resultat?.geom as Geometry | undefined) ?? demoGeom ?? null;
  const meta = resultat?.compose;

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-medium">Composer un itinéraire</h2>
      <p className="max-w-prose text-xs text-muted-foreground">
        Choisissez une ambiance, le moteur assemble un itinéraire. Le calcul (sélection des bases, sidecar) se
        branche à la bascule ; l'aperçu ci-dessous anime le tracé du résultat.
      </p>

      {archetypes && archetypes.length > 0 ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Choisir une ambiance">
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
      ) : null}

      <Bouton
        type="button"
        size="sm"
        disabled
        title="Le calcul se branche à la bascule (sélection des bases candidates + sidecar OR-Tools)"
      >
        Composer (à la bascule)
      </Bouton>
      {composer.isError ? <MessageErreur>La composition a échoué (service non branché).</MessageErreur> : null}

      {geom ? (
        <div className="space-y-1">
          <CarteItineraire geom={geom} />
          {meta ? (
            <p className="text-xs text-muted-foreground">
              {meta.nuits} nuits · {meta.n_bases} bases · {Math.round(meta.drive_h)} h de route.
            </p>
          ) : demoGeom ? (
            <p className="text-xs text-muted-foreground">Aperçu de démonstration (donnée factice, hors sidecar).</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
