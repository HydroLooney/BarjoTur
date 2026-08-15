import type { MonVoyageIdeal } from '@barjotur/shared';

// APERÇU DEV de « Mon voyage idéal » (#2), pour construire et CAPTURER le rendu tant que l'endpoint M554/B n'est pas
// déployé. Chargé seulement en DEV avec `?mon-voyage` (jamais en production). PAS des chiffres réels (R1) : exemples
// de structure (idéal composé + écart au commun). Au flip, `useMonVoyageIdeal` prend la vraie source serveur.

export const monVoyageIdealDemo: MonVoyageIdeal = {
  ideal: {
    ok: true,
    n_etapes: 9,
    route: [3, 7, 12, 5, 9, 14],
    nights_par_base: { '3': 3, '7': 4, '12': 2, '5': 3, '9': 4, '14': 2 },
    nuits_deficit: 0,
    geom: {
      type: 'MultiLineString',
      coordinates: [
        [
          [8.0, 58.15],
          [6.6, 58.9],
          [5.3, 59.41],
          [6.15, 60.39],
          [7.9, 61.1],
          [8.5, 61.5],
        ],
      ],
    },
  },
  ecart: {
    bases_ideal: [3, 7, 12, 5, 9, 14],
    bases_commun: [3, 7, 5, 9, 2, 8],
    bases_partagees: [3, 7, 5, 9],
    bases_perso_seules: [12, 14],
    satisfaction_ideal: 0.92,
    satisfaction_dans_commun: 0.78,
    resume: 'Le voyage commun honore 4 de tes 6 coups de cœur.',
  },
};
