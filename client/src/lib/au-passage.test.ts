import { describe, expect, it } from 'vitest';
import { estGlisse, type SuggestionAuPassage } from '@/lib/au-passage';

function s(niveau: SuggestionAuPassage['niveau'], cout: number): SuggestionAuPassage {
  return { nom: 'x', niveau, cout_detour_min: cout, cout_detour_km: cout / 5 };
}

describe('estGlisse', () => {
  it('un fort à faible détour, sous la tolérance, est glissé', () => {
    expect(estGlisse(s('vaut_le_voyage', 10), 30)).toBe(true);
    expect(estGlisse(s('vaut_le_detour', 25), 30)).toBe(true);
  });
  it('un fort au-delà de la tolérance reste une suggestion', () => {
    expect(estGlisse(s('vaut_le_voyage', 45), 30)).toBe(false);
  });
  it('un lieu « au passage » (pas fort) n’est jamais glissé auto', () => {
    expect(estGlisse(s('au_passage', 5), 100)).toBe(false);
  });
  it('curseur à 0 (on reste efficace) ne glisse quasi rien', () => {
    expect(estGlisse(s('vaut_le_voyage', 5), 0)).toBe(false);
  });
});
