import type { FeatureCollection } from 'geojson';

// Sentiers rando de démonstration (T048 / M098), à la FORME de `diffusion.v_web_sentiers` (propriétés `nom`,
// `difficulte`, géométrie LineString 4326). Valeurs ILLUSTRATIVES (R1) autour du Lysefjord : elles disent la
// forme de l'écran (style par difficulté, clic, seuil de zoom), pas la vérité du terrain. Au flip, la vraie
// couche vient d'A via tuiles Martin (gaté DSN/tiles) ; la source passe de ce GeoJSON à un `type: 'vector'`.
export const sentiersDemo: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { nom: 'Preikestolen', difficulte: 'moyen' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [6.14, 58.98],
          [6.16, 58.985],
          [6.19, 58.986],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { nom: 'Kjerag', difficulte: 'difficile' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [6.58, 59.03],
          [6.6, 59.035],
          [6.63, 59.04],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { nom: 'Flørli 4444', difficulte: 'expert' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [6.48, 59.02],
          [6.485, 59.03],
          [6.49, 59.045],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { nom: 'Sentier du fjord', difficulte: 'facile' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [6.3, 58.95],
          [6.33, 58.955],
          [6.36, 58.958],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { nom: 'Boucle forestière', difficulte: 'non gradé' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [6.2, 59.05],
          [6.22, 59.055],
          [6.24, 59.05],
        ],
      },
    },
  ],
};
