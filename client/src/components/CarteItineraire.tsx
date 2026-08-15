import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Source, Layer, Marker, NavigationControl, useMap } from '@vis.gl/react-maplibre';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import {
  modeleAnimationFigeGeom,
  etatAuTemps,
  type EtapeEntree,
  type ModeleAnim,
  type Nature,
  type Phase,
} from '@/lib/anim-trajet';
import { charte } from '@/ui/theme';
import { CENTRE_NORVEGE } from '@/lib/carte-config';
import { CadreCarte } from '@/components/CadreCarte';
import { ControleCamera } from '@/lib/carte-cadrage';
import { CurseurAnime } from '@/components/CurseurAnime';
import { useUi } from '@/stores/ui';

// Carte itineraire animee (T012 / C16). Consomme la math PURE de lib/anim-trajet (rendu strict
// fige.geom) et dessine avec @vis.gl/react-maplibre. Un seul contexte WebGL, couleurs via jetons
// de charte (zero hex, darkmode-aware : les couches relisent les jetons au changement de theme).
//
// Rendu : trace complet estompe (ghost) + segments terrestres pleins (boucle) + traversees d'eau
// TIRETEES (liaison), plus un marqueur qui parcourt le trace au prorata du TEMPS (A05).

const DUREE_BOUCLE_MS = 12000;

// Reference stable pour la valeur par defaut d'`etapes` : un `[]` inline serait recree a chaque
// render et rendrait le useMemo de `modele` instable (l'animation redemarrerait a chaque re-render parent).
const ETAPES_VIDES: EtapeEntree[] = [];

interface Props {
  /** fige.geom (ou null tant que l'itineraire n'est pas charge : la carte montre alors le fond seul). */
  geom: Geometry | null;
  etapes?: EtapeEntree[];
  hauteur?: string;
  /** Recentre sur l'étape au clic d'une puce jour (barre d'animation, M499/M502/M511). */
  centrer?: { lon: number; lat: number; zoom?: number } | null;
}

/** Reconstruit une [lon, lat] GeoJSON depuis un point interne [lat, lng]. */
function versLonLat(p: [number, number]): [number, number] {
  return [p[1], p[0]];
}

/** FeatureCollection des segments d'une nature ET d'une phase données (un segment = 2 sommets). */
function segmentsFiltre(modele: ModeleAnim, nat: Nature, phase: Phase): FeatureCollection {
  const features: Feature[] = [];
  for (let i = 1; i < modele.pts.length; i++) {
    if (modele.nature[i] !== nat) continue;
    if (modele.phase[i] !== phase) continue;
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

/**
 * Trace complet estompé (ghost), mais UNIQUEMENT sur les segments ROUTÉS : on ROMPT le trait aux « liaisons »
 * (traversées d'eau / corridors non routés) pour ne JAMAIS dessiner une droite PLEINE point-à-point (M555 §2, R1 :
 * on ne fait pas croire à une route qui n'existe pas). Les liaisons restent rendues à part, en TIRETÉS « en attente /
 * traversée ». Résultat : ghost plein le long de la route, pointillés sur l'eau, aucune droite pleine visible.
 */
function traceComplet(modele: ModeleAnim): FeatureCollection {
  const features: Feature[] = [];
  let run: [number, number][] = [];
  const pousser = () => {
    if (run.length >= 2) {
      features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: run } });
    }
  };
  for (let i = 0; i < modele.pts.length; i++) {
    const p = modele.pts[i];
    if (!p) continue;
    // La nature d'indice i décrit le segment pts[i-1]→pts[i] : une liaison est un SAUT → on coupe le ghost avant.
    if (i > 0 && modele.nature[i] === 'liaison') {
      pousser();
      run = [versLonLat(p)];
    } else {
      run.push(versLonLat(p));
    }
  }
  pousser();
  return { type: 'FeatureCollection', features };
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

/** Elargit une emprise d'un facteur (0.30 = +30 %) autour de son centre (M213 regle 1 : on voit tout le voyage). */
function elargirBbox(
  b: [[number, number], [number, number]],
  facteur: number,
): [[number, number], [number, number]] {
  const [[minLon, minLat], [maxLon, maxLat]] = b;
  const dLon = ((maxLon - minLon) * facteur) / 2;
  const dLat = ((maxLat - minLat) * facteur) / 2;
  return [
    [minLon - dLon, minLat - dLat],
    [maxLon + dLon, maxLat + dLat],
  ];
}

/**
 * CHORÉGRAPHIE de caméra (étape 4, caméra M218 — sous-brique 1 : cadrage + entrée).
 * Au lancement on NE recentre PAS sèchement sur la bbox : on part du DÉPART (un cran zoomé, « on est sur place »)
 * puis on ANIME une ENTRÉE DOUCE vers la bbox du trajet ÉLARGIE de 30 % (« on arrive sur le voyage »). Une fois
 * la bbox atteinte, le cadre est STABLE (pas de recentrage pendant l'animation ; l'utilisateur garde la main).
 * Ne rejoue qu'au montage / changement de figé.
 */
// Interface caméra MapLibre minimale (on ne type que ce qu'on utilise ; heurt de versions du style-spec).
interface CameraMap {
  on(t: string, cb: () => void): void;
  off(t: string, cb: () => void): void;
  getZoom(): number;
  easeTo(o: { center: [number, number]; duration: number }): void;
}

const ZOOM_SUIVI = 7.2; // au-delà (vue rapprochée) la caméra PEUT suivre le curseur ; en deçà, cadre stable.

function ChoregraphieCamera({
  modele,
  bornes,
  t,
}: {
  modele: ModeleAnim;
  bornes: [[number, number], [number, number]] | null;
  t: number;
}) {
  const { current: carte } = useMap();
  const cede = useRef(false); // l'utilisateur a pris la main → la caméra ne fait plus rien d'auto (M307 sb5).
  const dernierSuivi = useRef(0);
  const prevT = useRef(0);

  // ENTRÉE (sb1) : au montage / changement de figé, on se pose au départ puis on desserre en douceur vers la bbox+30%.
  useEffect(() => {
    if (!carte || !bornes || modele.pts.length < 2) return;
    cede.current = false;
    const depart = modele.pts[0];
    if (!depart) return;
    carte.jumpTo({ center: [depart[1], depart[0]], zoom: 6.2 });
    const to = window.setTimeout(() => {
      carte.fitBounds(elargirBbox(bornes, 0.3), { padding: 28, duration: 2200, essential: true });
    }, 400);
    return () => window.clearTimeout(to);
  }, [carte, bornes, modele]);

  // USER GARDE LA MAIN (sb5) : dès qu'il fait GLISSER la carte, la caméra cède (plus de suivi ni de sortie auto).
  // Le zoom molette n'annule pas (au contraire, il active le suivi) ; c'est le PAN qui signale « je pilote ».
  useEffect(() => {
    const map = carte?.getMap?.() as unknown as CameraMap | undefined;
    if (!map) return;
    const onPan = () => {
      cede.current = true;
    };
    map.on('dragstart', onPan);
    return () => map.off('dragstart', onPan);
  }, [carte]);

  // SUIVI selon le zoom (sb5) + SORTIE au retour (sb6), sur l'avancée du curseur, tant que l'utilisateur n'a pas cédé.
  useEffect(() => {
    if (!carte) return;
    const map = carte.getMap?.() as unknown as CameraMap | undefined;
    if (!map || cede.current || !bornes || modele.pts.length < 2) {
      prevT.current = t;
      return;
    }
    // SORTIE (sb6) : bouclage (le curseur repasse du retour → départ) → on se REPOSE sur tout le voyage, en douceur.
    const wrap = prevT.current > modele.total * 0.85 && t < modele.total * 0.15;
    prevT.current = t;
    if (wrap && map.getZoom() > ZOOM_SUIVI) {
      // On était en suivi rapproché → SORTIE : on re-desserre vers la bbox+30% (symétrique de l'entrée).
      carte.fitBounds(elargirBbox(bornes, 0.3), { padding: 28, duration: 1800 });
      return;
    }
    // SUIVI : seulement en vue RAPPROCHÉE (l'utilisateur a zoomé) ; amorti, throttlé, jamais brusque.
    if (map.getZoom() >= ZOOM_SUIVI) {
      const now = performance.now();
      if (now - dernierSuivi.current > 700) {
        const etat = etatAuTemps(modele, t);
        if (etat) {
          map.easeTo({ center: [etat.ll[1], etat.ll[0]], duration: 650 });
          dernierSuivi.current = now;
        }
      }
    }
  }, [carte, t, modele, bornes]);

  return null;
}

/** Marqueur mobile : rendu du curseur (mode + nuit) à la position du temps `t` (horloge partagée avec la caméra). */
function MarqueurMobile({ modele, t }: { modele: ModeleAnim; t: number }) {
  const etat = etatAuTemps(modele, t);
  if (!etat) return null;
  // Curseur PAR MODE + NUIT (sous-brique 2) : van (terre) / ferry (traversée) dérivés du modèle ; variante nuit
  // au voisinage d'une nuitée. pied/transport se brancheront quand le mode par segment arrivera (donnée A).
  return (
    <Marker longitude={etat.ll[1]} latitude={etat.ll[0]}>
      <CurseurAnime mode={etat.mode} nuit={etat.nuit} />
    </Marker>
  );
}

export function CarteItineraire({ geom, etapes = ETAPES_VIDES, hauteur = '70vh', centrer = null }: Props) {
  const theme = useUi((s) => s.theme);
  const modele = useMemo(() => modeleAnimationFigeGeom(geom, etapes), [geom, etapes]);
  const vide = modele.pts.length < 2;

  // Horloge d'animation PARTAGÉE (curseur + caméra) : t parcourt [0, total] en boucle, piloté par le TEMPS cumulé
  // (avec dwell ∝ nuits, sous-brique 4) → le curseur ralentit aux camps. La caméra lit le même t (suivi/sortie).
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

  // Couleurs relues aux jetons a chaque changement de theme (darkmode coherent, zero hex ici).
  // Recalcule les couleurs aux jetons a chaque changement de theme (darkmode coherent, zero hex).
  // Couleurs ALLER / RETOUR (sous-brique 3) : cohérentes avec la barre/agenda/carnet (mêmes jetons `--fil-aller/retour`).
  const couleurs = useMemo(
    () => ({
      ghost: charte('--filet'),
      aller: charte('--fil-aller'),
      retour: charte('--fil-retour'),
      // Casing de contraste (M372) : liseré halo thème-aware sous le tracé plein → il décolle du topo (clair ET sombre).
      casing: charte('--carte-etiquette-halo'),
    }),
    [theme],
  );
  // Largeurs INTERPOLÉES au zoom (M372) : le tracé s'épaissit à fort zoom, avec un casing plus large dessous.
  const wBoucle = ['interpolate', ['linear'], ['zoom'], 4, 3, 8, 4.5, 12, 6.5] as unknown as number;
  const wCasing = ['interpolate', ['linear'], ['zoom'], 4, 5.5, 8, 7.5, 12, 10] as unknown as number;
  const wLiaison = ['interpolate', ['linear'], ['zoom'], 4, 2.4, 8, 3.4, 12, 4.6] as unknown as number;

  const fcGhost = useMemo(() => traceComplet(modele), [modele]);
  const fcAllerBoucle = useMemo(() => segmentsFiltre(modele, 'boucle', 'aller'), [modele]);
  const fcRetourBoucle = useMemo(() => segmentsFiltre(modele, 'boucle', 'retour'), [modele]);
  const fcAllerLiaison = useMemo(() => segmentsFiltre(modele, 'liaison', 'aller'), [modele]);
  const fcRetourLiaison = useMemo(() => segmentsFiltre(modele, 'liaison', 'retour'), [modele]);
  const bornes = useMemo(() => emprise(modele), [modele]);

  // Overlay d'etat vide (frere du canvas), passe en surimpression du cadre partage.
  const surimpression = vide ? (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-card/90 px-4 py-2 text-sm text-muted-foreground">
      Aucun itineraire charge pour l'instant. Le trace s'animera des que le fige est disponible.
    </div>
  ) : null;

  // Passe par le CADRE PARTAGE (CadreCarte) : un seul monteur du <Map> pour les trois vues (A05 / T051), fond
  // et dimensions communs. Le reveal anime (sources/couches/marqueur) reste ENTIER dans les enfants (useMap).
  return (
    <CadreCarte initialViewState={CENTRE_NORVEGE} hauteur={hauteur} surimpression={surimpression}>
      <NavigationControl position="top-right" />
      {/* Recentrage propre au clic d'une puce jour (M511, remplace le handle DEV window.__carte). */}
      <ControleCamera cible={centrer} zoomDefaut={9} />

      {!vide && (
        <>
          <ChoregraphieCamera modele={modele} bornes={bornes} t={t} />
          <Source id="itin-ghost" type="geojson" data={fcGhost}>
            <Layer
              id="itin-ghost-l"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': couleurs.ghost, 'line-width': 6, 'line-opacity': 0.35 }}
            />
          </Source>
          {/* ALLER : casing de contraste dessous + segment plein ; traversées d'eau tiretées, couleur aller. */}
          <Source id="itin-aller-boucle" type="geojson" data={fcAllerBoucle}>
            <Layer id="itin-aller-boucle-casing" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': couleurs.casing, 'line-width': wCasing, 'line-opacity': 0.9 }} />
            <Layer id="itin-aller-boucle-l" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': couleurs.aller, 'line-width': wBoucle }} />
          </Source>
          <Source id="itin-aller-liaison" type="geojson" data={fcAllerLiaison}>
            <Layer id="itin-aller-liaison-l" type="line" paint={{ 'line-color': couleurs.aller, 'line-width': wLiaison, 'line-dasharray': [2, 2] }} />
          </Source>
          {/* RETOUR : même figuré, couleur retour. */}
          <Source id="itin-retour-boucle" type="geojson" data={fcRetourBoucle}>
            <Layer id="itin-retour-boucle-casing" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': couleurs.casing, 'line-width': wCasing, 'line-opacity': 0.9 }} />
            <Layer id="itin-retour-boucle-l" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': couleurs.retour, 'line-width': wBoucle }} />
          </Source>
          <Source id="itin-retour-liaison" type="geojson" data={fcRetourLiaison}>
            <Layer id="itin-retour-liaison-l" type="line" paint={{ 'line-color': couleurs.retour, 'line-width': wLiaison, 'line-dasharray': [2, 2] }} />
          </Source>
          <MarqueurMobile modele={modele} t={t} />
        </>
      )}
    </CadreCarte>
  );
}
