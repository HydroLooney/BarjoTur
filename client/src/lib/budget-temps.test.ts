import { describe, expect, it } from 'vitest';
import {
  ajusterDuree,
  ajusterFlanerie,
  arrondiPas,
  clampAppetit,
  contraindrePalier,
  formatDuree,
} from '@/lib/budget-temps';

const libre = { min_min: 60, max_min: 180, pas_min: 15, granularite: 'libre' as const };

describe('arrondiPas', () => {
  it('arrondit au pas de 15 au plus proche', () => {
    expect(arrondiPas(67)).toBe(60);
    expect(arrondiPas(68)).toBe(75);
    expect(arrondiPas(90)).toBe(90);
  });
  it('jamais de pas de 30 (le pas reste 15)', () => {
    expect(arrondiPas(52) % 15).toBe(0);
    expect(arrondiPas(83) % 15).toBe(0);
  });
});

describe('ajusterDuree (libre)', () => {
  it('clampe sous le plancher', () => {
    expect(ajusterDuree(20, libre)).toBe(60);
  });
  it('clampe au plafond', () => {
    expect(ajusterDuree(300, libre)).toBe(180);
  });
  it('arrondit dans la plage au pas de 15', () => {
    expect(ajusterDuree(100, libre)).toBe(105);
    expect(ajusterDuree(97, libre)).toBe(90);
  });
  it('le plancher prime sur un arrondi qui descendrait dessous', () => {
    // min 65 non multiple de 15 : l'arrondi donnerait 60, le plancher 65 gagne.
    expect(ajusterDuree(66, { ...libre, min_min: 65 })).toBe(65);
  });
  it('sans max, reste borné par le seul plancher', () => {
    expect(ajusterDuree(1000, { min_min: 15, pas_min: 15, granularite: 'libre' })).toBe(1005);
  });
});

describe('ajusterDuree (en bloc, paliers)', () => {
  const kayak = { min_min: 240, pas_min: 15, granularite: 'demi_journee' as const, granularites: [240, 480] };
  it('jamais en dessous du plus petit palier', () => {
    expect(ajusterDuree(90, kayak)).toBe(240);
  });
  it('choisit le palier le plus proche', () => {
    expect(ajusterDuree(300, kayak)).toBe(240);
    expect(ajusterDuree(400, kayak)).toBe(480);
  });
});

describe('contraindrePalier', () => {
  it('renvoie la valeur clampée à 0 sans palier', () => {
    expect(contraindrePalier(-5, [])).toBe(0);
  });
});

describe('clampAppetit', () => {
  it('borne dans [0,1]', () => {
    expect(clampAppetit(-0.3)).toBe(0);
    expect(clampAppetit(1.5)).toBe(1);
    expect(clampAppetit(0.4)).toBe(0.4);
  });
  it('NaN -> 0', () => {
    expect(clampAppetit(Number.NaN)).toBe(0);
  });
});

describe('ajusterFlanerie', () => {
  it('>= 0 et arrondie au pas de 15', () => {
    expect(ajusterFlanerie(-30)).toBe(0);
    expect(ajusterFlanerie(52)).toBe(45);
    expect(ajusterFlanerie(68)).toBe(75);
  });
});

describe('formatDuree', () => {
  it('minutes seules, heures rondes, heures + minutes', () => {
    expect(formatDuree(45)).toBe('45 min');
    expect(formatDuree(120)).toBe('2 h');
    expect(formatDuree(150)).toBe('2 h 30');
    expect(formatDuree(0)).toBe('0 min');
  });
});
