import type { MultiLineString } from 'geojson';

// Fixture de DEV UNIQUEMENT (chargee dynamiquement sous import.meta.env.DEV, jamais en prod), pour la
// verif visuelle du rendu de la carte animee sans le BFF : un trace cotier ouest-norvegien plausible en
// DEUX troncons routes separes par une TRAVERSEE d'eau (grand saut) qui doit se rendre TIRETEE. Ce n'est
// PAS le consensus reel (fige 141) : la verif end-to-end sur donnee reelle reste le volet live du gate C16.
export const figeGeomDemo: MultiLineString = {
  type: 'MultiLineString',
  coordinates: [
    // Troncon 1 : Kristiansand -> Stavanger -> Haugesund (route cotiere).
    [
      [8.0, 58.15],
      [7.2, 58.35],
      [6.6, 58.9],
      [5.9, 58.9],
      [5.5, 59.2],
      [5.3, 59.41],
    ],
    // Troncon 2 : apres une traversee (ferry) vers Bergen, puis remontee des fjords.
    [
      [6.15, 60.39],
      [6.6, 60.55],
      [7.2, 60.7],
      [7.9, 61.1],
      [8.5, 61.5],
    ],
  ],
};
