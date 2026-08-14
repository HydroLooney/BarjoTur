import type { VarianteLiaison } from '@barjotur/shared';

// Arbitrage temps↔argent d'une liaison (M092 §3), hors live. Valeurs ILLUSTRATIVES (R1) : elles disent la FORME
// de l'écran (« par le ferry 1 h / 30 € » vs « par la route 2 h 10 / gratuit », front de Pareto, curseur de
// préférence). Les vraies variantes viennent d'A (routage, B040) au flip ; `carburant_eur` y est la valeur au
// param de base, recomposée à la volée par C via `coutCarburantEur(km, …)` quand les curseurs bougent.
export const liaisonDemoLibelle = 'Kristiansand → Stavanger';

export const variantesLiaisonDemo: VarianteLiaison[] = [
  {
    mode: 'defaut',
    temps_min: 60,
    km: 40,
    cout: { carburant_eur: 7.6, ferry_eur: 30, peage_eur: 0 },
  },
  {
    mode: 'sans_ferry',
    temps_min: 130,
    km: 180,
    cout: { carburant_eur: 34.2, ferry_eur: 0, peage_eur: 0 },
  },
  {
    mode: 'sans_peage',
    temps_min: 145,
    km: 195,
    cout: { carburant_eur: 37.05, ferry_eur: 0, peage_eur: 0 },
  },
];
