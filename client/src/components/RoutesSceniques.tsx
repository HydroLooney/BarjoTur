import 'maplibre-gl/dist/maplibre-gl.css';
import { useMemo, useState } from 'react';
import { Source, Layer } from '@vis.gl/react-maplibre';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { charte } from '@/ui/theme';
import { CadreCarte } from '@/components/CadreCarte';
import { useUi } from '@/stores/ui';
import { useCartoData, martinTuiles, martinSourceLayer } from '@/lib/carto-source';
import { CadrageAuto, bboxDeFeatures } from '@/lib/carte-cadrage';
import { cn } from '@/lib/utils';

// C19 (M424/M434) : les ROUTES SCÉNIQUES (18 itinéraires panoramiques, LineString BFF) + la couche des BASES idéales
// (18 points de nuit, tuiles Martin `v_web_bases_ideales`, B135) sur une même carte. Une liste latérale donne le nom,
// la région, la longueur et l'intérêt de chaque route ; cliquer une route re-cadre la carte dessus et la met en
// avant. Les bases (points de chute) sont une couche togglable. Un seul contexte WebGL (A05), couleurs aux jetons
// (dark-safe, zéro hex). Lecture (pas de réglage) : aider à composer, pas décider à la place.

const VUE = { longitude: 8.4, latitude: 62, zoom: 4.2 };
const VIDE: FeatureCollection = { type: 'FeatureCollection', features: [] };

const exprNum = (e: unknown): number => e as unknown as number;
const exprStr = (e: unknown): string => e as unknown as string;

const idRoute = (f: Feature<Geometry>): string => String(f.properties?.id ?? '');
const nomRoute = (f: Feature<Geometry>): string => String(f.properties?.nom ?? f.properties?.nom_no ?? 'Route');

export function RoutesSceniques({ hauteur = '68vh' }: { hauteur?: string }) {
  const theme = useUi((s) => s.theme);
  const routes = useCartoData('routesSceniques');
  const basesTuiles = martinTuiles('basesTuiles');
  const [selection, setSelection] = useState<string | null>(null);
  const [basesVisibles, setBasesVisibles] = useState(true);

  const features = useMemo(() => (routes.data?.features ?? []) as Feature<Geometry>[], [routes.data]);
  const routeSelectionnee = useMemo(
    () => features.find((f) => idRoute(f) === selection) ?? null,
    [features, selection],
  );

  // Emprise : la route retenue (re-cadrage au clic) ou l'ensemble des routes. CadrageAuto re-cadre au changement.
  const bornes = useMemo(
    () => bboxDeFeatures(routeSelectionnee ? [routeSelectionnee] : features),
    [features, routeSelectionnee],
  );

  const c = useMemo(
    () => ({
      base: charte('--accent'),
      selection: charte('--ocre'),
      casing: charte('--papier'),
      etiquette: charte('--foreground'),
      etiquetteHalo: charte('--carte-etiquette-halo'),
      basePoint: charte('--glacier'),
      baseHalo: charte('--papier'),
    }),
    [theme],
  );

  // Couleur de ligne : la route retenue en avant (ocre), les autres en accent. Recalcul au thème / à la sélection.
  const couleurLigne = useMemo<string>(
    () => (selection ? exprStr(['case', ['==', exprStr(['get', 'id']), selection], c.selection, c.base]) : c.base),
    [selection, c.base, c.selection],
  );
  const largeurLigne = useMemo<number>(
    () => (selection ? exprNum(['case', ['==', exprStr(['get', 'id']), selection], 5, 2.4]) : 3),
    [selection],
  );

  const chargement = routes.isLoading && features.length === 0;

  const panneauCarte = (
    <div className="absolute right-2 top-2 z-10 rounded-lg border border-border bg-card/95 p-2 text-xs shadow-flottante backdrop-blur-sm">
      <label className="flex min-h-tactile cursor-pointer items-center gap-2">
        <input type="checkbox" checked={basesVisibles} onChange={() => setBasesVisibles((v) => !v)} className="accent-primary" />
        <span aria-hidden className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: c.basePoint }} />
        Points de chute (nuit)
      </label>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-[1fr_20rem]">
        <CadreCarte hauteur={hauteur} surimpression={panneauCarte} initialViewState={VUE}>
          <CadrageAuto bornes={bornes} />

          {/* Routes scéniques : casing de contraste sous le trait, puis la ligne (ocre = retenue, accent = autres). */}
          {features.length ? (
            <Source id="routes-sceniques" type="geojson" data={routes.data ?? VIDE}>
              <Layer
                id="routes-casing"
                type="line"
                layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                paint={{ 'line-color': c.casing, 'line-width': exprNum(['+', largeurLigne, 3]), 'line-opacity': 0.85 }}
              />
              <Layer
                id="routes-ligne"
                type="line"
                layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                paint={{ 'line-color': couleurLigne, 'line-width': largeurLigne, 'line-opacity': 0.95 }}
              />
              <Layer
                id="routes-label"
                type="symbol"
                layout={{
                  'symbol-placement': 'line',
                  'text-field': exprStr(['get', 'nom']),
                  'text-font': ['noto_sans_regular'],
                  'text-size': exprNum(['interpolate', ['linear'], ['zoom'], 5, 10, 9, 13]),
                }}
                paint={{ 'text-color': c.etiquette, 'text-halo-color': c.etiquetteHalo, 'text-halo-width': 2 }}
              />
            </Source>
          ) : null}

          {/* Bases idéales (points de nuit) : tuiles Martin, structurantes plus grosses. Halo papier = lisible partout. */}
          {basesVisibles && basesTuiles ? (
            <Source id="bases-ideales" type="vector" tiles={[basesTuiles]} minzoom={3} maxzoom={14}>
              <Layer
                id="bases-pt"
                type="circle"
                source-layer={martinSourceLayer('basesTuiles')}
                paint={{
                  'circle-radius': exprNum(['interpolate', ['linear'], ['zoom'], 4, ['case', ['get', 'structurante'], 5, 3], 9, ['case', ['get', 'structurante'], 8, 5.5]]),
                  'circle-color': c.basePoint,
                  'circle-stroke-color': c.baseHalo,
                  'circle-stroke-width': 1.6,
                }}
              />
            </Source>
          ) : null}
        </CadreCarte>

        {/* Liste des routes : nom, région, longueur, intérêt. Cliquer re-cadre + met en avant. */}
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Routes scéniques · <span className="chiffres">{features.length}</span>
          </p>
          {routes.isError ? (
            <p className="text-sm text-muted-foreground">Routes scéniques indisponibles pour le moment.</p>
          ) : chargement ? (
            <p className="text-sm text-muted-foreground">Chargement des routes…</p>
          ) : (
            <ul className="max-h-[62vh] space-y-1 overflow-y-auto pr-1">
              {features.map((f) => {
                const actif = idRoute(f) === selection;
                const km = f.properties?.longueur_km;
                const region = f.properties?.region;
                const interet = f.properties?.interet;
                return (
                  <li key={idRoute(f)}>
                    <button
                      type="button"
                      onClick={() => setSelection((s) => (s === idRoute(f) ? null : idRoute(f)))}
                      aria-pressed={actif}
                      className={cn(
                        'w-full space-y-0.5 rounded-lg border px-3 py-2 text-left text-sm shadow-posee transition-colors duration-court',
                        actif ? 'border-accent bg-accent/10' : 'border-border bg-card hover:bg-muted',
                      )}
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="font-medium">{nomRoute(f)}</span>
                        {typeof km === 'number' ? (
                          <span className="chiffres shrink-0 text-xs text-muted-foreground">{km} km</span>
                        ) : null}
                      </span>
                      {region ? <span className="block text-xs text-muted-foreground">{String(region)}</span> : null}
                      {actif && interet ? (
                        <span className="block pt-0.5 text-xs text-muted-foreground">{String(interet)}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
