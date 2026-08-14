import type { SuggestionAuPassage } from '@/lib/au-passage';

// Suggestions « au passage » de démonstration (A24 / M110), le long d'un trajet type. Valeurs ILLUSTRATIVES (R1) :
// elles disent la forme de l'écran (étiquette + coût de détour, glissé vs suggestion, effet du curseur). Au flip,
// B expose la vraie liste d'une étape (POI dans le buffer de détour du tracé calculé) ; la forme ne bouge pas.
export const auPassageDemo: SuggestionAuPassage[] = [
  { nom: 'Cascade de Låtefossen', niveau: 'vaut_le_detour', cout_detour_min: 15, cout_detour_km: 6 },
  { nom: 'Église en bois debout de Røldal', niveau: 'vaut_le_voyage', cout_detour_min: 20, cout_detour_km: 9 },
  { nom: 'Point de vue sur le fjord', niveau: 'au_passage', cout_detour_min: 5, cout_detour_km: 2 },
  { nom: 'Village de Odda', niveau: 'vaut_le_detour', cout_detour_min: 55, cout_detour_km: 28 },
  { nom: 'Petite plage tranquille', niveau: 'au_passage', cout_detour_min: 10, cout_detour_km: 4 },
];
