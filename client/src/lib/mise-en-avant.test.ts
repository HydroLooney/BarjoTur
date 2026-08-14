import { describe, expect, it } from 'vitest';
import { miseEnAvantDeScore } from '@/lib/mise-en-avant';

describe('miseEnAvantDeScore', () => {
  it('les trois niveaux selon le score', () => {
    expect(miseEnAvantDeScore(0.9)).toBe('vaut_le_voyage');
    expect(miseEnAvantDeScore(0.7)).toBe('vaut_le_detour');
    expect(miseEnAvantDeScore(0.5)).toBe('au_passage');
  });
  it('rien en dessous du seuil bas', () => {
    expect(miseEnAvantDeScore(0.3)).toBeNull();
  });
  it('null / NaN / absent -> pas d’étiquette', () => {
    expect(miseEnAvantDeScore(null)).toBeNull();
    expect(miseEnAvantDeScore(undefined)).toBeNull();
    expect(miseEnAvantDeScore(Number.NaN)).toBeNull();
  });
});
