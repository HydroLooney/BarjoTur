import { useEffect, useMemo, useRef, useState } from 'react';
import { Source, Layer, Popup, useMap } from '@vis.gl/react-maplibre';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { IconeCategorie } from '@/components/IconeCategorie';
import { IndiceConfiance } from '@/components/IndiceConfiance';
import { CATEGORIES, FAMILLES, categorieDe, tokenCategorie } from '@/lib/categories-poi';
import { exprProminence } from '@/lib/tiers-score';
import { charte } from '@/ui/theme';
import { useUi } from '@/stores/ui';

// Marqueurs POI (étape 3, sous-étapes 2+3) : CLUSTERING natif MapLibre (la densité disparaît en vue d'ensemble →
// « zéro fouillis », doctrine) + marqueur CONCEPT A (pastille couleur de famille + icône blanche) pour les POI
// individuels au près. Les icônes sont rastérisées une fois (React → SVG → image) et enregistrées comme images de
// carte `cat-<bucket>` ; la couche symbole les pose par `icon-image`. Recolorées au changement de thème (dark-safe).
// Zéro hex : couleurs via `charte()`.

const exprAny = (e: unknown): never => e as never;
const S = 46; // px de l'image marqueur (rendu net à pixelRatio 2)

function svgMarqueur(cat: string): string {
  const couleur = charte(tokenCategorie(cat));
  const blanc = charte('--blanc');
  const halo = charte('--papier');
  // Icône (24x24, trait blanc) rendue depuis le composant React puis nichée dans la pastille.
  const inner = renderToStaticMarkup(<IconeCategorie categorie={cat} trait={2.4} />)
    .replace('<svg ', `<svg x="12" y="12" width="22" height="22" color="${blanc}" `);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 46 46">
    <circle cx="23" cy="23" r="17" fill="${couleur}" stroke="${halo}" stroke-width="2.5"/>
    ${inner}
  </svg>`;
}

async function imageDepuisSvg(svg: string): Promise<ImageData> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('svg'));
      img.src = url;
    });
    const dpr = 2;
    const cv = document.createElement('canvas');
    cv.width = S * dpr;
    cv.height = S * dpr;
    const ctx = cv.getContext('2d')!;
    ctx.drawImage(img, 0, 0, S * dpr, S * dpr);
    return ctx.getImageData(0, 0, S * dpr, S * dpr);
  } finally {
    URL.revokeObjectURL(url);
  }
}

interface MapLike {
  hasImage: (id: string) => boolean;
  removeImage: (id: string) => void;
  addImage: (id: string, img: ImageData, opts?: { pixelRatio?: number }) => void;
}

// Interface d'événements MapLibre minimale (les deux copies du style-spec divergent ; on ne type que ce qu'on utilise).
interface EvtCarteFeature {
  geometry: { coordinates: number[] };
  properties: Record<string, unknown> | null;
}
interface EvtCarte {
  features?: EvtCarteFeature[];
}
interface CarteEvts {
  on(t: string, l: string, cb: (e: EvtCarte) => void): void;
  off(t: string, l: string, cb: (e: EvtCarte) => void): void;
  getCanvas(): HTMLCanvasElement;
  getSource(id: string): { getClusterExpansionZoom(cid: number, cb: (err: unknown, z: number) => void): void } | undefined;
  easeTo(o: { center: number[]; zoom: number; duration?: number }): void;
}

export function MarqueursCategories({
  data,
  actives,
  votablesOnly = true,
  onSelectPoi,
}: {
  data: FeatureCollection;
  actives: Set<string>;
  // C17 : par défaut la carte ne montre que les POI VOTABLES (le sous-ensemble scoré, 486/778 ; champ `votable`
  // livré par A), pour désencombrer. Le voyageur révèle les repères/services non votables (services van, hors-emprise)
  // en décochant « Votables seulement ». On se BRANCHE sur le booléen, on ne l'infère pas (M327).
  votablesOnly?: boolean;
  // Clic sur un marqueur POI (M375 §3) : remonte la feature (props + géométrie) au parent pour ouvrir la fiche en overlay.
  onSelectPoi?: (feature: { properties: Record<string, unknown> | null; geometry: { coordinates: number[] } }) => void;
}) {
  const { current: carte } = useMap();
  const theme = useUi((s) => s.theme);
  // Ref pour appeler le callback frais depuis les listeners MapLibre (liés une fois, deps [carte]).
  const onSelectRef = useRef(onSelectPoi);
  onSelectRef.current = onSelectPoi;

  // Données filtrées par catégories actives (le clustering recompte sur l'ensemble actif) ET, par défaut, sur `votable`.
  const filtre = useMemo<FeatureCollection>(() => {
    const feats = (data.features ?? []) as Feature<Geometry>[];
    return {
      type: 'FeatureCollection',
      features: feats.filter((f) => {
        if (!actives.has(String(f.properties?.categorie_calque))) return false;
        if (votablesOnly && f.properties?.votable !== true) return false;
        return true;
      }),
    };
  }, [data, actives, votablesOnly]);

  // Génère / régénère les 18 images de marqueur (recolorées au thème).
  useEffect(() => {
    const map = carte?.getMap?.() as unknown as MapLike | undefined;
    if (!map) return;
    // Poignée de QA (DEV only) : permet de piloter la caméra depuis les captures (flyTo ville dense).
    if (import.meta.env.DEV) (window as unknown as { __carte?: unknown }).__carte = carte;
    let annule = false;
    (async () => {
      for (const c of CATEGORIES) {
        const id = `cat-${c.cle}`;
        try {
          const data = await imageDepuisSvg(svgMarqueur(c.cle));
          if (annule) return;
          if (map.hasImage(id)) map.removeImage(id);
          map.addImage(id, data, { pixelRatio: 2 });
        } catch {
          /* une icône ratée ne casse pas la carte */
        }
      }
    })();
    return () => {
      annule = true;
    };
  }, [carte, theme]);

  // Survol (carte d'info) + sélection au clic (grossissement + halo, SPEC §1/§5).
  const [survol, setSurvol] = useState<{
    lng: number;
    lat: number;
    nom: string;
    cat: string;
    frequente: boolean;
    zone: string;
    poiId: string | number;
    confiance: number | null;
  } | null>(null);
  const [selId, setSelId] = useState<string | number | null>(null);

  // Index des PÉPITES par zone (coin de valeur PEU fréquenté : tier T/S/A non `tres_frequente`, M313) — pour
  // proposer une alternative au calme dans la carte de survol d'un incontournable bondé (« au lieu de la foule… »).
  const pepitesParZone = useMemo(() => {
    const m = new Map<string, { ll: number[]; nom: string; id: string | number; cat: string }[]>();
    for (const f of (data.features ?? []) as Feature<Geometry>[]) {
      const p = f.properties ?? {};
      if (p.tres_frequente === true) continue;
      if (!['T', 'S', 'A'].includes(String(p.tier))) continue;
      const z = String(p.zone_id ?? '');
      const g = f.geometry as { coordinates?: number[] };
      if (!g.coordinates) continue;
      const arr = m.get(z) ?? [];
      arr.push({ ll: g.coordinates, nom: String(p.nom ?? 'Lieu'), id: (p.poi_id as string | number) ?? '', cat: String(p.categorie_calque ?? '') });
      m.set(z, arr);
    }
    return m;
  }, [data]);

  useEffect(() => {
    const map = carte?.getMap?.() as unknown as CarteEvts | undefined;
    if (!map) return;
    const PT = 'poi-cat-pt';
    const CL = 'poi-cat-cluster';
    const survole = (e: EvtCarte) => {
      const f = e.features?.[0];
      if (!f) return;
      map.getCanvas().style.cursor = 'pointer';
      const [lng, lat] = f.geometry.coordinates;
      const p = f.properties ?? {};
      setSurvol({
        lng: lng ?? 0,
        lat: lat ?? 0,
        nom: String(p.nom ?? 'Lieu'),
        cat: String(p.categorie_calque ?? ''),
        frequente: p.tres_frequente === true || p.tres_frequente === 'true',
        zone: String(p.zone_id ?? ''),
        poiId: (p.poi_id as string | number) ?? '',
        confiance: typeof p.confiance === 'number' ? p.confiance : null,
      });
    };
    const quitte = () => {
      map.getCanvas().style.cursor = '';
      setSurvol(null);
    };
    const clic = (e: EvtCarte) => {
      const f = e.features?.[0];
      if (!f) return;
      setSelId((f.properties?.poi_id as string | number) ?? null);
      onSelectRef.current?.({ properties: f.properties, geometry: f.geometry });
    };
    const clicCluster = (e: EvtCarte) => {
      const f = e.features?.[0];
      if (!f) return;
      const cid = Number(f.properties?.cluster_id);
      // Drill-down au CLIC (M375 §5) : on descend d'un cran vers l'intérieur du cluster (zoom d'expansion natif),
      // animation DOUCE ; le retour arrière se fait au dézoom. (Le drill-down hiérarchique par découpage = C15.)
      map.getSource('poi-cat')?.getClusterExpansionZoom(cid, (err, z) => {
        if (!err) map.easeTo({ center: f.geometry.coordinates, zoom: z, duration: 650 });
      });
    };
    const mainCurseur = (v: string) => () => {
      map.getCanvas().style.cursor = v;
    };
    map.on('mouseenter', PT, survole);
    map.on('mousemove', PT, survole);
    map.on('mouseleave', PT, quitte);
    map.on('click', PT, clic);
    map.on('click', CL, clicCluster);
    map.on('mouseenter', CL, mainCurseur('pointer'));
    map.on('mouseleave', CL, mainCurseur(''));
    return () => {
      map.off('mouseenter', PT, survole);
      map.off('mousemove', PT, survole);
      map.off('mouseleave', PT, quitte);
      map.off('click', PT, clic);
      map.off('click', CL, clicCluster);
    };
  }, [carte]);

  const couleurCluster = charte('--glacier');
  const halo = charte('--papier');
  const texteCluster = charte('--papier');
  const couleurFoule = charte('--ocre'); // signal « très fréquenté » (alerte douce, hors-foule étape 5)
  const couleurPepite = charte('--vert'); // pépite : coin de valeur PEU fréquenté (alternative au calme)
  const catSurvol = survol ? categorieDe(survol.cat) : null;

  // Pour un incontournable BONDÉ : les 2 pépites les plus proches DANS LA MÊME zone (l'alternative au calme, M313).
  const pepitesProches =
    survol && survol.frequente
      ? (pepitesParZone.get(survol.zone) ?? [])
          .filter((x) => x.id !== survol.poiId && x.ll.length >= 2)
          .map((x) => ({ ...x, d: Math.hypot((x.ll[0] ?? 0) - survol.lng, (x.ll[1] ?? 0) - survol.lat) }))
          .sort((a, b) => a.d - b.d)
          .slice(0, 2)
      : [];

  const selNonCluster = (extra: unknown) => exprAny(['all', ['!', ['has', 'point_count']], extra]);

  return (
    <>
      <Source
        id="poi-cat"
        type="geojson"
        data={filtre}
        cluster
        clusterRadius={44}
        clusterMaxZoom={7}
        // C13 : le cluster agrège le compte PAR TIER (5 crans). Sert au compteur (total) ET à la proéminence : une bulle
        // qui cache un incontournable (T) porte plus de valeur qu'une bulle de seuls secondaires (C) → elle est plus forte.
        clusterProperties={exprAny({
          nT: ['+', ['case', ['==', ['get', 'tier'], 'T'], 1, 0]],
          nS: ['+', ['case', ['==', ['get', 'tier'], 'S'], 1, 0]],
          nA: ['+', ['case', ['==', ['get', 'tier'], 'A'], 1, 0]],
          nB: ['+', ['case', ['==', ['get', 'tier'], 'B'], 1, 0]],
          nC: ['+', ['case', ['==', ['get', 'tier'], 'C'], 1, 0]],
        })}
      >
        {/* Bulle de cluster : rayon selon le compte, ET accent (liseré) selon le MEILLEUR tier caché dedans (T>S>A). */}
        <Layer
          id="poi-cat-cluster"
          type="circle"
          filter={exprAny(['has', 'point_count'])}
          paint={{
            'circle-color': couleurCluster,
            'circle-stroke-color': halo,
            // Liseré plus épais si le cluster cache un tier haut (T/S) : il « vaut le détour ».
            'circle-stroke-width': exprAny(['case', ['>', ['get', 'nT'], 0], 3.5, ['>', ['get', 'nS'], 0], 2.6, 1.6]),
            'circle-radius': exprAny(['step', ['get', 'point_count'], 13, 10, 17, 30, 22, 80, 27]),
          }}
        />
        <Layer
          id="poi-cat-cluster-nb"
          type="symbol"
          filter={exprAny(['has', 'point_count'])}
          layout={{ 'text-field': exprAny(['get', 'point_count_abbreviated']), 'text-font': ['noto_sans_bold'], 'text-size': 13 }}
          paint={{ 'text-color': texteCluster }}
        />
        {/* Sélection : halo derrière (sous l'icône). */}
        {selId != null ? (
          <Layer
            id="poi-cat-sel-halo"
            type="circle"
            filter={selNonCluster(['==', ['get', 'poi_id'], selId])}
            paint={{ 'circle-radius': 19, 'circle-color': halo, 'circle-opacity': 0.5, 'circle-stroke-color': couleurCluster, 'circle-stroke-width': 1 }}
          />
        ) : null}
        {/* HORS-FOULE (étape 5) — signaux SOBRES derrière l'icône (SPEC §1, « signaler sans crier ») :
            « très fréquenté » = liseré ocre ; « pépite » (coin de valeur T/S PEU fréquenté) = liseré vert calme. */}
        <Layer
          id="poi-cat-foule"
          type="circle"
          filter={exprAny(['all', ['!', ['has', 'point_count']], ['==', ['get', 'tres_frequente'], true]])}
          paint={{
            'circle-radius': exprAny(['interpolate', ['linear'], ['zoom'], 5, 8, 9, 12, 12, 16]),
            'circle-color': 'transparent',
            'circle-stroke-color': couleurFoule,
            'circle-stroke-width': 2,
            'circle-stroke-opacity': 0.75,
          }}
        />
        <Layer
          id="poi-cat-pepite"
          type="circle"
          filter={exprAny([
            'all',
            ['!', ['has', 'point_count']],
            ['!=', ['get', 'tres_frequente'], true],
            ['in', ['get', 'tier'], ['literal', ['T', 'S', 'A']]],
          ])}
          paint={{
            'circle-radius': exprAny(['interpolate', ['linear'], ['zoom'], 5, 7, 9, 11, 12, 15]),
            'circle-color': 'transparent',
            'circle-stroke-color': couleurPepite,
            'circle-stroke-width': 1.4,
            'circle-stroke-opacity': 0.55,
          }}
        />
        {/* POI individuel : marqueur concept A (pastille + icône). PROÉMINENCE PAR TIER (C13, 5 crans) : la taille = base
            (selon zoom) × facteur de tier (T le plus grand, C le plus discret). ÉMERGENCE PAR TIER : l'opacité monte au
            zoom d'émergence du tier → au dézoom, C s'efface EN PREMIER, T reste le plus longtemps (ordre C→T, M334). */}
        <Layer
          id="poi-cat-pt"
          type="symbol"
          filter={exprAny(['!', ['has', 'point_count']])}
          layout={{
            'icon-image': exprAny(['concat', 'cat-', ['get', 'categorie_calque']]),
            // Taille = base(zoom) × proéminence(tier). `zoom` DOIT être l'entrée de tête d'`interpolate` (contrainte
            // MapLibre) → on met le facteur de tier dans les SORTIES (les stops sont des expressions data-driven, OK).
            // Plancher ET plafond haut-zoom RELEVÉS (M372/QA Guillaume) : à z12+ l'icône est confortablement lisible,
            // à z15 franchement présente ; même un C reste clairement cliquable. La hit-area suit la taille (symbole).
            'icon-size': exprAny([
              'interpolate',
              ['linear'],
              ['zoom'],
              5,
              ['*', 0.38, exprProminence()],
              9,
              ['*', 0.64, exprProminence()],
              12,
              ['*', 1.0, exprProminence()],
              15,
              ['*', 1.32, exprProminence()],
            ]),
            'icon-allow-overlap': true,
          }}
          paint={{
            // Émergence par tier via des sorties `match` par palier de zoom (zoom en tête). Au dézoom, l'opacité de C
            // tombe la première, celle de T tient jusqu'au bout → ordre d'agglomération C→T (M334).
            'icon-opacity': exprAny([
              'interpolate',
              ['linear'],
              ['zoom'],
              5,
              ['match', ['get', 'tier'], 'T', 1, 'S', 0.15, 'A', 0.04, 'B', 0, 'C', 0, 0.2],
              6.8,
              ['match', ['get', 'tier'], 'T', 1, 'S', 1, 'A', 0.6, 'B', 0.1, 'C', 0, 0.6],
              8.2,
              ['match', ['get', 'tier'], 'T', 1, 'S', 1, 'A', 1, 'B', 0.7, 'C', 0.15, 0.85],
              9.4,
              ['match', ['get', 'tier'], 'T', 1, 'S', 1, 'A', 1, 'B', 1, 'C', 0.7, 1],
              11,
              1,
            ]),
          }}
        />
        {/* Sélection : l'icône grossie par-dessus. */}
        {selId != null ? (
          <Layer
            id="poi-cat-sel"
            type="symbol"
            filter={selNonCluster(['==', ['get', 'poi_id'], selId])}
            layout={{
              'icon-image': exprAny(['concat', 'cat-', ['get', 'categorie_calque']]),
              'icon-size': exprAny(['interpolate', ['linear'], ['zoom'], 5, 0.5, 9, 0.78, 12, 1.05]),
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
            }}
          />
        ) : null}
        {/* Étiquettes de titre au près seulement (densité décroissante, doctrine §5) ; halo, anti-collision. */}
        <Layer
          id="poi-cat-label"
          type="symbol"
          minzoom={10.5}
          filter={exprAny(['!', ['has', 'point_count']])}
          layout={{
            'text-field': exprAny(['get', 'nom']),
            'text-font': ['noto_sans_regular'],
            'text-size': 11,
            'text-offset': [0, 1.3],
            'text-anchor': 'top',
            'text-max-width': 8,
            'text-optional': true,
          }}
          paint={{ 'text-color': charte('--foreground'), 'text-halo-color': charte('--carte-etiquette-halo'), 'text-halo-width': 1.6 }}
        />
      </Source>

      {/* Carte de survol (HTML riche, SPEC §5) : vignette catégorie + titre soigné + signal hors-foule. */}
      {survol && catSurvol ? (
        <Popup longitude={survol.lng} latitude={survol.lat} closeButton={false} closeOnClick={false} offset={20} anchor="bottom" className="carte-survol">
          <div className="w-52 p-2.5">
            <div className="flex items-center gap-2">
              <span
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[var(--papier)]"
                style={{ backgroundColor: `var(${FAMILLES[catSurvol.famille].token})` }}
              >
                <IconeCategorie categorie={catSurvol.cle} className="h-4 w-4" trait={2.4} />
              </span>
              <p className="font-serif text-section leading-tight">{survol.nom}</p>
            </div>
            <p className="mt-1 text-meta text-muted-foreground">{catSurvol.libelle}</p>
            {/* Confiance = axe SÉPARÉ du tier (M362) : « validé », pas « important ». Indice neutre, discret. */}
            <IndiceConfiance valeur={survol.confiance} className="mt-1" />
            {survol.frequente ? (
              <span
                className="mt-1.5 inline-block rounded-full px-2 py-0.5 text-[0.625rem] font-medium"
                style={{ backgroundColor: 'var(--ocre-voile)', color: 'var(--ocre-actif)' }}
              >
                Très fréquenté
              </span>
            ) : null}
            {/* Alternative au calme (M313) : les pépites proches, dans la même zone. */}
            {survol.frequente && pepitesProches.length ? (
              <div className="mt-2 border-t border-border pt-1.5">
                <p className="flex items-center gap-1 text-[0.625rem] font-medium" style={{ color: 'var(--vert)' }}>
                  <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--vert)' }} />
                  Au lieu de la foule, tout près
                </p>
                <ul className="mt-0.5 space-y-0.5">
                  {pepitesProches.map((p) => (
                    <li key={String(p.id)} className="flex items-center gap-1.5 text-meta">
                      <span style={{ color: `var(${FAMILLES[categorieDe(p.cat).famille].token})` }}>
                        <IconeCategorie categorie={p.cat} className="h-3 w-3" trait={2.4} />
                      </span>
                      {p.nom}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </Popup>
      ) : null}
    </>
  );
}
