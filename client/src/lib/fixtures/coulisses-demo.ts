import type { FeatureCollection } from 'geojson';

// Échantillon SCHÉMATIQUE pour la coquille de la carte de coulisses (T069). R1 : ce ne sont PAS les vraies
// limites — juste des rectangles sur la Norvège pour que les toggles de calques montrent quelque chose avant
// que les vues `v_web_*` d'A (découpage région/zone/sous-zone + bases idéales) arrivent au dump. Marqué démo.

function rect(lon0: number, lat0: number, lon1: number, lat1: number, nom: string): FeatureCollection['features'][number] {
  return {
    type: 'Feature',
    properties: { nom },
    geometry: {
      type: 'Polygon',
      coordinates: [[[lon0, lat0], [lon1, lat0], [lon1, lat1], [lon0, lat1], [lon0, lat0]]],
    },
  };
}

export const regionsDemo: FeatureCollection = {
  type: 'FeatureCollection',
  features: [rect(5, 58, 9, 61, 'Région Sud'), rect(5, 61, 11, 64, 'Région Fjords')],
};

export const zonesDemo: FeatureCollection = {
  type: 'FeatureCollection',
  features: [rect(5, 58, 7, 61, 'Zone A'), rect(7, 58, 9, 61, 'Zone B'), rect(5, 61, 8, 64, 'Zone C')],
};

export const sousZonesDemo: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    rect(5, 58, 6, 59.5, 'Sous-zone 1'),
    rect(6, 59.5, 7, 61, 'Sous-zone 2'),
    rect(7, 58, 8, 59.5, 'Sous-zone 3'),
    rect(8, 61, 11, 64, 'Sous-zone 4'),
  ],
};

export const basesIdealesDemo: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { nom: 'Base 1' }, geometry: { type: 'Point', coordinates: [6.1, 58.9] } },
    { type: 'Feature', properties: { nom: 'Base 2' }, geometry: { type: 'Point', coordinates: [7.9, 60.3] } },
    { type: 'Feature', properties: { nom: 'Base 3' }, geometry: { type: 'Point', coordinates: [9.2, 62.7] } },
  ],
};
