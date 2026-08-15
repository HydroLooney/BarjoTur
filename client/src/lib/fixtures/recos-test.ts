import type { Reco } from '@barjotur/shared';

// JEU DE TEST DEV UNIQUEMENT (R1, NON réel) : 5 recos sur des POI RÉELS du dev, avec leur `sous_zone_id`, pour cribler
// visuellement la couche animée + le flux clic → sous-zone → fiche (l'endpoint réel rend `[]` en dev). Gaté
// `import.meta.env.DEV`, jamais en prod ; au flip la vraie donnée `recos_voyageur` le remplace, zéro re-câblage.
//
// NB CONTRAT (signalé à M) : `sous_zone_id` est un SLUG STRING en réalité ('telemark-rjukan__4'…), pas un `number`
// `sous_zone_id` = slug string (contrat corrigé `string | null` en shared, M429) → plus de cast, type propre.
export const RECOS_TEST: Reco[] = [
  { cle: 'poi:373', nom: 'Farstad & Co', lon: 9.60755, lat: 59.21069, sous_zone_id: 'telemark-rjukan__4', tier: 'C', rang: 1 },
  { cle: 'poi:235', nom: 'Lac Femunden', lon: 11.8962, lat: 62.18494, sous_zone_id: 'innlandet-est__13', tier: 'B', rang: 2 },
  { cle: 'poi:410', nom: 'Sverre Sætre Konditori', lon: 10.71867, lat: 59.91958, sous_zone_id: 'oslo__2', tier: 'C', rang: 3 },
  { cle: 'poi:255', nom: 'Solund', lon: 4.89619, lat: 61.1276, sous_zone_id: 'bergen__20', tier: 'B', rang: 4 },
  { cle: 'poi:292', nom: 'Dalen', lon: 8.003, lat: 59.439, sous_zone_id: 'telemark-rjukan__12', tier: 'B', rang: 5 },
];
