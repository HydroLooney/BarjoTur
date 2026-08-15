import { useEffect } from 'react';
import { useMap } from '@vis.gl/react-maplibre';
import type { Feature, Geometry, Position } from 'geojson';

// Cadrage partagé (DOCTRINE-CARTO : « on voit tout d'un coup », bbox + 30 %). Extrait pour que la coulisses et la
// carte animée cadrent pareil. Composant à monter EN ENFANT de <Map> (il lit le contexte via useMap).

export type Bornes = [[number, number], [number, number]];

/** Élargit une emprise d'un facteur (0.30 = +30 %) autour de son centre. */
export function elargirBbox(b: Bornes, facteur: number): Bornes {
  const [[minLon, minLat], [maxLon, maxLat]] = b;
  const dLon = ((maxLon - minLon) * facteur) / 2;
  const dLat = ((maxLat - minLat) * facteur) / 2;
  return [
    [minLon - dLon, minLat - dLat],
    [maxLon + dLon, maxLat + dLat],
  ];
}

/** Bbox d'un ensemble de features GeoJSON (parcourt toutes les coordonnées). null si vide. */
export function bboxDeFeatures(features: Feature<Geometry>[]): Bornes | null {
  let minLon = Infinity,
    minLat = Infinity,
    maxLon = -Infinity,
    maxLat = -Infinity;
  const visiter = (c: Position | Position[] | Position[][] | Position[][][]) => {
    const lon = (c as Position)[0];
    const lat = (c as Position)[1];
    if (typeof lon === 'number' && typeof lat === 'number') {
      if (lon < minLon) minLon = lon;
      if (lat < minLat) minLat = lat;
      if (lon > maxLon) maxLon = lon;
      if (lat > maxLat) maxLat = lat;
    } else {
      for (const sub of c as Position[]) visiter(sub);
    }
  };
  for (const f of features) {
    const g = f.geometry;
    if (g && 'coordinates' in g) visiter(g.coordinates as Position[]);
  }
  if (!Number.isFinite(minLon)) return null;
  return [
    [minLon, minLat],
    [maxLon, maxLat],
  ];
}

/**
 * Cadre la carte sur `bornes` (élargies de `facteur`) au montage / changement de données. Ne joue qu'à ce
 * moment-là : la caméra ne chasse rien ensuite (l'utilisateur garde la main).
 */
export function CadrageAuto({
  bornes,
  facteur = 0.3,
  padding = 24,
}: {
  bornes: Bornes | null;
  facteur?: number;
  padding?: number;
}) {
  const { current: carte } = useMap();
  useEffect(() => {
    if (carte && bornes) carte.fitBounds(elargirBbox(bornes, facteur), { padding, duration: 0 });
  }, [carte, bornes, facteur, padding]);
  return null;
}
