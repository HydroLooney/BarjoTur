import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useMemo, useState } from 'react';
import { Map, Source, Layer, Marker, NavigationControl, useMap } from '@vis.gl/react-maplibre';
import type { Feature, FeatureCollection, Geometry, LineString } from 'geojson';
import {
  modeleAnimationFigeGeom,
  positionAuTemps,
  type EtapeEntree,
  type ModeleAnim,
  type Nature,
} from '@/lib/anim-trajet';
import { charte } from '@/ui/theme';
import { useUi } from '@/stores/ui';

// Carte itineraire animee (T012 / C16). Consomme la math PURE de lib/anim-trajet (rendu strict
// fige.geom) et dessine avec @vis.gl/react-maplibre. Un seul contexte WebGL, couleurs via jetons
// de charte (zero hex, darkmode-aware : les couches relisent les jetons au changement de theme).
//
// Rendu : trace complet estompe (ghost) + segments terrestres pleins (boucle) + traversees d'eau
// TIRETEES (liaison), plus un marqueur qui parcourt le trace au prorata du TEMPS (A05).

const FOND = 'https://tiles.openfreemap.org/styles/positron';
const CENTRE_NORVEGE = { longitude: 10, latitude: 63, zoom: 3.4 };
const DUREE_BOUCLE_MS = 12000;

// Reference stable pour la valeur par defaut d'`etapes` : un `[]` inline serait recree a chaque
// render et rendrait le useMemo de `modele` instable (l'animation redemarrerait a chaque re-render parent).
const ETAPES_VIDES: EtapeEntree[] = [];

interface Props {
  /** fige.geom (ou null tant que l'itineraire n'est pas charge : la carte montre alors le fond seul). */
  geom: Geometry | null;
  etapes?: EtapeEntree[];
  hauteur?: string;
}

/** Reconstruit une [lon, lat] GeoJSON depuis un point interne [lat, lng]. */
function versLonLat(p: [number, number]): [number, number] {
  return [p[1], p[0]];
}

/** FeatureCollection des segments d'une nature donnee (un segment = 2 sommets). */
function segmentsDeNature(modele: ModeleAnim, nat: Nature): FeatureCollection {
  const features: Feature[] = [];
  for (let i = 1; i < modele.pts.length; i++) {
    if (modele.nature[i] !== nat) continue;
    const a = modele.pts[i - 1];
    const b = modele.pts[i];
    if (!a || !b) continue;
    features.push({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: [versLonLat(a), versLonLat(b)] },
    });
  }
  return { type: 'FeatureCollection', features };
}

/** Trace complet en une LineString (pour le ghost estompe). */
function traceComplet(modele: ModeleAnim): FeatureCollection {
  const ligne: LineString = { type: 'LineString', coordinates: modele.pts.map(versLonLat) };
  return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: ligne }] };
}

/** Emprise [[minLon, minLat], [maxLon, maxLat]] du trace, ou null si vide. */
function emprise(modele: ModeleAnim): [[number, number], [number, number]] | null {
  if (modele.pts.length < 2) return null;
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const p of modele.pts) {
    const lon = p[1];
    const lat = p[0];
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [
    [minLon, minLat],
    [maxLon, maxLat],
  ];
}

/** Cadre la carte sur l'emprise du trace au montage / changement de trace. */
function Cadrage({ bornes }: { bornes: [[number, number], [number, number]] | null }) {
  const { current: carte } = useMap();
  useEffect(() => {
    if (carte && bornes) carte.fitBounds(bornes, { padding: 48, duration: 0 });
  }, [carte, bornes]);
  return null;
}

/** Marqueur mobile : parcourt le trace en boucle, pilote par le TEMPS cumule (requestAnimationFrame). */
function MarqueurMobile({ modele }: { modele: ModeleAnim }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (modele.pts.length < 2) return;
    let raf = 0;
    let debut = 0;
    const pas = (horodatage: number) => {
      if (!debut) debut = horodatage;
      const frac = ((horodatage - debut) % DUREE_BOUCLE_MS) / DUREE_BOUCLE_MS;
      setT(frac * modele.total);
      raf = requestAnimationFrame(pas);
    };
    raf = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(raf);
  }, [modele]);

  const p = positionAuTemps(modele, t);
  if (!p) return null;
  return (
    <Marker longitude={p[1]} latitude={p[0]}>
      <span
        aria-hidden
        style={{
          display: 'block',
          width: 14,
          height: 14,
          borderRadius: '9999px',
          background: 'var(--ocre)',
          border: '2px solid var(--papier)',
          boxShadow: 'var(--ombre)',
        }}
      />
    </Marker>
  );
}

export function CarteItineraire({ geom, etapes = ETAPES_VIDES, hauteur = '70vh' }: Props) {
  const theme = useUi((s) => s.theme);
  const modele = useMemo(() => modeleAnimationFigeGeom(geom, etapes), [geom, etapes]);
  const vide = modele.pts.length < 2;

  // Couleurs relues aux jetons a chaque changement de theme (darkmode coherent, zero hex ici).
  // Recalcule les couleurs aux jetons a chaque changement de theme (darkmode coherent, zero hex).
  const couleurs = useMemo(
    () => ({
      ghost: charte('--filet'),
      boucle: charte('--glacier'),
      liaison: charte('--granite'),
    }),
    [theme],
  );

  const fcGhost = useMemo(() => traceComplet(modele), [modele]);
  const fcBoucle = useMemo(() => segmentsDeNature(modele, 'boucle'), [modele]);
  const fcLiaison = useMemo(() => segmentsDeNature(modele, 'liaison'), [modele]);
  const bornes = useMemo(() => emprise(modele), [modele]);

  return (
    <div className="relative overflow-hidden rounded-lg border border-border" style={{ height: hauteur }}>
      <Map initialViewState={CENTRE_NORVEGE} mapStyle={FOND} style={{ width: '100%', height: '100%' }}>
        <NavigationControl position="top-right" />
        {!vide && (
          <>
            <Cadrage bornes={bornes} />
            <Source id="itin-ghost" type="geojson" data={fcGhost}>
              <Layer
                id="itin-ghost-l"
                type="line"
                layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                paint={{ 'line-color': couleurs.ghost, 'line-width': 6, 'line-opacity': 0.35 }}
              />
            </Source>
            <Source id="itin-boucle" type="geojson" data={fcBoucle}>
              <Layer
                id="itin-boucle-l"
                type="line"
                layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                paint={{ 'line-color': couleurs.boucle, 'line-width': 4 }}
              />
            </Source>
            <Source id="itin-liaison" type="geojson" data={fcLiaison}>
              <Layer
                id="itin-liaison-l"
                type="line"
                paint={{ 'line-color': couleurs.liaison, 'line-width': 3, 'line-dasharray': [2, 2] }}
              />
            </Source>
            <MarqueurMobile modele={modele} />
          </>
        )}
      </Map>
      {vide && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-card/90 px-4 py-2 text-sm text-muted-foreground">
          Aucun itineraire charge pour l'instant. Le trace s'animera des que le fige est disponible.
        </div>
      )}
    </div>
  );
}
