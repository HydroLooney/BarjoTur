import type { MiseEnAvant } from '@/lib/mise-en-avant';

// Suggestions « au passage » (A24 / M110) : le beau qu'on attrape le long du trajet, sans détour coûteux. La
// DÉCISION d'insérer (récompense ≥ coût_détour × f(budget restant)) vit côté composeur (B, gaté DSN). Ici, côté
// écran, on affiche la liste et on illustre l'effet du curseur « sensibilité au détour » : un fort à faible
// détour est « glissé dans la journée », les autres restent une suggestion « à vous de vous arrêter ». Forme
// front, à confirmer au flip (B expose la liste réelle d'une étape).

/** Un lieu proposé le long du trajet. `insere` (fixture) = ce que le composeur glisserait ; recalculé au curseur. */
export interface SuggestionAuPassage {
  nom: string;
  niveau: MiseEnAvant;
  /** Coût du détour pour y passer. */
  cout_detour_min: number;
  cout_detour_km: number;
}

/**
 * « Glissé dans la journée » (illustratif front) : un lieu FORT (vaut le voyage / le détour) dont le détour tient
 * sous la tolérance du curseur `sensibilite` (0 = on reste efficace, 100 = on s'écarte volontiers, en minutes de
 * détour tolérées). Sinon, c'est une suggestion « à vous de vous arrêter ». Le vrai arbitrage est côté composeur.
 */
export function estGlisse(s: SuggestionAuPassage, sensibilite: number): boolean {
  const fort = s.niveau === 'vaut_le_voyage' || s.niveau === 'vaut_le_detour';
  return fort && s.cout_detour_min <= sensibilite;
}
