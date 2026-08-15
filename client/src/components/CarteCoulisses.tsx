import 'maplibre-gl/dist/maplibre-gl.css';
import { useMemo, useState } from 'react';
import { Source, Layer } from '@vis.gl/react-maplibre';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { charte } from '@/ui/theme';
import { CadreCarte } from '@/components/CadreCarte';
import { useUi } from '@/stores/ui';
import { useCartoData } from '@/lib/carto-source';
import { CadrageAuto, bboxDeFeatures } from '@/lib/carte-cadrage';

// Carte de COULISSES (T069) : diagnostic backstage, PAS l'app publique. Une question : « comment le territoire
// est-il découpé en enveloppes, et où sont les bases idéales ? ». Donc UNIQUEMENT le découpage (Régions / Zones /
// Sous-zones, un toggle par niveau) + les bases idéales. Un seul contexte WebGL via CadreCarte (A05). Zéro hex.
//
// Données RÉELLES (dump A) : découpage 4 régions + 22 zones (polygones) + 102 sous-zones (centroïdes), 102 bases.
//
// Crible M235 (3 bloqueurs réglés) :
//  1. FOUILLIS des bases → d'ensemble on ne montre que les 28 STRUCTURANTES (petit marqueur), les 74 autres
//     n'apparaissent qu'en zoomant (palier amorti). Taille du point fortement réduite au loin.
//  2. CADRAGE → fit-bounds sur le découpage (bbox + 30 %) au montage, plus de mer/Suède vides.
//  3. ÉTIQUETTES régions → rendues EN DERNIER (au-dessus des points), avec offset + halo, collision propre
//     (masquées plutôt qu'illisibles). Contours de région TIRETÉS = « enveloppes diagnostic », pas des frontières.

// Repli si les données tardent (le cadrage auto prend le relais dès qu'elles arrivent) : sud de la Norvège.
const VUE = { longitude: 8.4, latitude: 61, zoom: 5 };

// Palette des régions : sur fond papier chaud, on mène par le FRAIS (leçon carto validée M235) — glacier, vert,
// puis chaud franc. Les bases restent lisibles partout grâce à leur halo papier (M211).
const TOKENS_REGION = ['--glacier', '--vert', '--espace-mes-envies', '--ocre'];
const REPLI_REGION = '--glacier';
const tokenRegion = (i: number): string => TOKENS_REGION[i % TOKENS_REGION.length] ?? REPLI_REGION;

// Casts d'expression MapLibre → leur type de sortie par entité (contournement du heurt de versions du style-spec ;
// l'expression est bien évaluée au runtime).
const exprNum = (e: unknown): number => e as unknown as number;
const exprStr = (e: unknown): string => e as unknown as string;

interface Calque {
  cle: 'regions' | 'zones' | 'sousZones' | 'bases';
  libelle: string;
  puce: string;
  forme: 'ligne' | 'point';
}

const CALQUES: Calque[] = [
  { cle: 'regions', libelle: 'Régions', puce: '--glacier', forme: 'ligne' },
  { cle: 'zones', libelle: 'Zones', puce: '--granite', forme: 'ligne' },
  { cle: 'sousZones', libelle: 'Sous-zones', puce: '--granite', forme: 'point' },
  { cle: 'bases', libelle: 'Bases idéales', puce: '--glacier', forme: 'point' },
];

function fc(features: Feature<Geometry>[]): FeatureCollection {
  return { type: 'FeatureCollection', features };
}

export function CarteCoulisses({ hauteur = '70vh' }: { hauteur?: string }) {
  const theme = useUi((s) => s.theme);
  const [actifs, setActifs] = useState<Record<Calque['cle'], boolean>>({
    regions: true,
    zones: false,
    sousZones: false,
    bases: true,
  });
  const [calquesOuvert, setCalquesOuvert] = useState(false); // replié par défaut (M239 : discret, la carte est la vedette)

  const decoupage = useCartoData('decoupage');
  const bases = useCartoData('bases');

  // Sépare le découpage par niveau, et les bases en structurantes / autres (pour le dé-fouillis au zoom).
  const d = useMemo(() => {
    const feats = (decoupage.data?.features ?? []) as Feature<Geometry>[];
    const par = (n: string) => feats.filter((f) => f.properties?.niveau === n);
    const b = (bases.data?.features ?? []) as Feature<Geometry>[];
    return {
      regions: par('region'),
      zones: par('zone'),
      sousZones: par('sous_zone'),
      basesStruct: b.filter((f) => f.properties?.structurante),
      basesAutres: b.filter((f) => !f.properties?.structurante),
    };
  }, [decoupage.data, bases.data]);

  // Emprise du DÉCOUPAGE (régions + zones) pour le cadrage — pas les bases (un point isolé au nord étirerait la vue).
  const bornes = useMemo(() => bboxDeFeatures([...d.regions, ...d.zones]), [d.regions, d.zones]);

  // Couleurs résolues aux jetons (dark-safe, recalcul au thème).
  const c = useMemo(
    () => ({
      zone: charte('--granite'),
      sousZone: charte('--granite'),
      base: charte('--glacier'),
      baseHalo: charte('--papier'),
      // Étiquettes de région = texte principal du diagnostic → encre pleine + halo papier.
      etiquette: charte('--foreground'),
      etiquetteHalo: charte('--carte-etiquette-halo'),
      puces: Object.fromEntries(CALQUES.map((x) => [x.cle, charte(x.puce)])) as Record<Calque['cle'], string>,
    }),
    [theme],
  );

  const couleurRegion = useMemo<string>(() => {
    const ids = d.regions.map((f) => String(f.properties?.id ?? ''));
    const paires = ids.flatMap((id, i) => [id, charte(tokenRegion(i))]);
    return exprStr(['match', ['get', 'id'], ...paires, charte(REPLI_REGION)]);
  }, [d.regions, theme]);

  function bascule(cle: Calque['cle']) {
    setActifs((a) => ({ ...a, [cle]: !a[cle] }));
  }

  const chargement = decoupage.isLoading || bases.isLoading;
  const erreur = decoupage.isError || bases.isError;

  // Panneau de calques REPLIABLE + fond SOLIDE + DISCRET (fix Guillaume M239). Replié par défaut : une petite puce
  // « Calques ». Déplié : l'en-tête replie, les toggles + la note s'affichent sur un fond de carte opaque lisible.
  const panneau = !calquesOuvert ? (
    <button
      type="button"
      onClick={() => setCalquesOuvert(true)}
      className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-lg border border-border bg-card/95 px-2.5 py-1 text-micro font-medium text-muted-foreground shadow-posee backdrop-blur-sm transition-colors duration-court hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span aria-hidden>▤</span> Calques
    </button>
  ) : (
    <div className="absolute left-2 top-2 max-w-56 space-y-1 rounded-lg border border-border bg-card p-2 text-xs shadow-flottante">
      <button
        type="button"
        onClick={() => setCalquesOuvert(false)}
        className="flex w-full items-center justify-between font-medium text-muted-foreground hover:text-foreground"
      >
        Calques <span aria-hidden>▴</span>
      </button>
      {CALQUES.map((x) => (
        <label key={x.cle} className="flex min-h-tactile cursor-pointer items-center gap-2">
          <input type="checkbox" checked={actifs[x.cle]} onChange={() => bascule(x.cle)} className="accent-primary" />
          <span
            aria-hidden
            className={x.forme === 'point' ? 'inline-block h-3 w-3 rounded-full' : 'inline-block h-2 w-4 rounded-sm'}
            style={{ backgroundColor: c.puces[x.cle] }}
          />
          {x.libelle}
        </label>
      ))}
      <p className="pt-1 text-meta leading-tight text-muted-foreground">
        {erreur
          ? 'Découpage indisponible pour le moment.'
          : chargement
            ? 'Chargement du découpage…'
            : `Découpage : ${d.regions.length} régions, ${d.zones.length} zones, ${d.sousZones.length} sous-zones. ${d.basesStruct.length} bases structurantes en vue d'ensemble, les ${d.basesAutres.length} autres au zoom.`}
      </p>
    </div>
  );

  return (
    <CadreCarte hauteur={hauteur} surimpression={panneau} initialViewState={VUE}>
      <CadrageAuto bornes={bornes} />

      {/* Régions : vraies frontières administratives (A079) → aplat doux + CONTOUR PLEIN franc (M247, fini les
          tiretés d'enveloppe). Disjointes, donc les contours ne se croisent plus. */}
      {actifs.regions && d.regions.length ? (
        <Source id="coul-regions" type="geojson" data={fc(d.regions)}>
          <Layer id="coul-regions-fill" type="fill" paint={{ 'fill-color': couleurRegion, 'fill-opacity': 0.22 }} />
          <Layer id="coul-regions-line" type="line" paint={{ 'line-color': couleurRegion, 'line-width': 2.4 }} />
        </Source>
      ) : null}

      {/* Zones : contour PLEIN plus fin, neutre, sous les régions (parent_id = région). */}
      {actifs.zones && d.zones.length ? (
        <Source id="coul-zones" type="geojson" data={fc(d.zones)}>
          <Layer id="coul-zones-line" type="line" paint={{ 'line-color': c.zone, 'line-width': 1, 'line-opacity': 0.7 }} />
        </Source>
      ) : null}

      {/* Sous-zones : VRAIS APLATS grain 147 (A110, polygones) — aplat + contour fin pointillé neutre, très discret. */}
      {actifs.sousZones && d.sousZones.length ? (
        <Source id="coul-souszones" type="geojson" data={fc(d.sousZones)}>
          <Layer id="coul-souszones-fill" type="fill" paint={{ 'fill-color': c.sousZone, 'fill-opacity': 0.05 }} />
          <Layer id="coul-souszones-line" type="line" paint={{ 'line-color': c.sousZone, 'line-width': 0.6, 'line-dasharray': [2, 2], 'line-opacity': 0.55 }} />
        </Source>
      ) : null}

      {/* Bases AUTRES (74) : masquées en vue d'ensemble, apparaissent en fondu au zoom (dé-fouillis M235-1). */}
      {actifs.bases && d.basesAutres.length ? (
        <Source id="coul-bases-autres" type="geojson" data={fc(d.basesAutres)}>
          <Layer
            id="coul-bases-autres-pt"
            type="circle"
            paint={{
              'circle-radius': exprNum(['interpolate', ['linear'], ['zoom'], 6, 2, 9, 4.5]),
              'circle-color': c.base,
              'circle-opacity': exprNum(['interpolate', ['linear'], ['zoom'], 6.5, 0, 8.5, 0.8]),
              'circle-stroke-color': c.baseHalo,
              'circle-stroke-width': exprNum(['interpolate', ['linear'], ['zoom'], 6.5, 0, 8.5, 1]),
            }}
          />
        </Source>
      ) : null}

      {/* Bases STRUCTURANTES (28) : toujours visibles, petit marqueur au loin qui grossit de près (halo = contraste). */}
      {actifs.bases && d.basesStruct.length ? (
        <Source id="coul-bases-struct" type="geojson" data={fc(d.basesStruct)}>
          <Layer
            id="coul-bases-struct-pt"
            type="circle"
            paint={{
              'circle-radius': exprNum(['interpolate', ['linear'], ['zoom'], 4, 3, 6, 4.5, 9, 7]),
              'circle-color': c.base,
              'circle-stroke-color': c.baseHalo,
              'circle-stroke-width': exprNum(['interpolate', ['linear'], ['zoom'], 4, 1.2, 9, 2]),
            }}
          />
        </Source>
      ) : null}

      {/* Étiquettes de région EN DERNIER = au-dessus des points (fix M235-3 : plus percutées par les bases).
          Offset + halo + collision propre (masquées plutôt qu'illisibles), pas d'allow-overlap. */}
      {actifs.regions && d.regions.length ? (
        <Source id="coul-regions-labels" type="geojson" data={fc(d.regions)}>
          <Layer
            id="coul-regions-label"
            type="symbol"
            layout={{
              'text-field': exprStr(['get', 'id']),
              'text-font': ['noto_sans_bold'],
              'text-size': exprNum(['interpolate', ['linear'], ['zoom'], 4, 11, 7, 15]),
              'text-transform': 'uppercase',
              'text-letter-spacing': 0.06,
              'text-max-width': 10,
              'text-offset': [0, -0.4],
              'text-padding': 6,
            }}
            paint={{ 'text-color': c.etiquette, 'text-halo-color': c.etiquetteHalo, 'text-halo-width': 2.2 }}
          />
        </Source>
      ) : null}
    </CadreCarte>
  );
}
