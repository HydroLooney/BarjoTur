import type { BudgetTempsVisite } from '@barjotur/shared';

// Fixture de réglage budget-temps (M089), hors live. Valeurs ILLUSTRATIVES de la typologie A21 (baignade, kayak,
// point de vue, musée) : elles disent la FORME de l'écran (curseur libre vs paliers, flânerie, appétits), pas la
// vérité de calcul (typologie + durées proposées vivent chez A). R1 : ne pas les faire passer pour des données.

export interface VisiteDemo {
  id: string;
  libelle: string;
  theme: string;
  budget: BudgetTempsVisite;
}

export const visitesDemo: VisiteDemo[] = [
  {
    id: 'v-baignade',
    libelle: 'Baignade à la plage',
    theme: 'baignade',
    budget: { min_min: 60, defaut_min: 90, max_min: 180, pas_min: 15, granularite: 'libre', duree_retenue_min: 90, source: 'type' },
  },
  {
    id: 'v-kayak',
    libelle: 'Kayak sur le fjord',
    theme: 'nautique',
    budget: {
      min_min: 240,
      defaut_min: 240,
      pas_min: 15,
      granularite: 'demi_journee',
      granularites: [240, 480],
      duree_retenue_min: 240,
      source: 'type',
    },
  },
  {
    id: 'v-pointdevue',
    libelle: 'Point de vue sur le fjord',
    theme: 'panorama',
    budget: { min_min: 15, defaut_min: 20, max_min: 60, pas_min: 15, granularite: 'libre', duree_retenue_min: 20, source: 'type' },
  },
  {
    id: 'v-musee',
    libelle: 'Musée viking',
    theme: 'patrimoine',
    budget: { min_min: 60, defaut_min: 90, max_min: 240, pas_min: 15, granularite: 'libre', duree_retenue_min: 90, source: 'type' },
  },
];

export interface JourDemo {
  id: string;
  libelle: string;
  flanerieDefaut: number;
}

export const joursDemo: JourDemo[] = [
  { id: 'j1', libelle: 'Jour 1 · Kristiansand', flanerieDefaut: 60 },
  { id: 'j2', libelle: 'Jour 2 · vers Preikestolen', flanerieDefaut: 30 },
];

/** Thèmes ouverts au réglage d'appétit (la typologie vit chez A ; ici un échantillon d'écran). */
export const themesDemo: string[] = ['nautique', 'faune', 'patrimoine', 'baignade', 'panorama'];
