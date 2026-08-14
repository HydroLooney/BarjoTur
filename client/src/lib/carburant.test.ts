import { describe, expect, it } from 'vitest';
import {
  avecMarge,
  consoEffectiveL100,
  coutCarburantEur,
  CONSO_BASE_L_100,
  PRIX_DIESEL_BASE,
} from '@/lib/carburant';

describe('consoEffectiveL100', () => {
  it('sans surconsommation = base 9,5', () => {
    expect(consoEffectiveL100(0)).toBe(CONSO_BASE_L_100);
  });
  it('+20% de surconsommation', () => {
    expect(consoEffectiveL100(20)).toBeCloseTo(11.4, 5);
  });
  it('surconsommation négative bornée à 0', () => {
    expect(consoEffectiveL100(-30)).toBe(CONSO_BASE_L_100);
  });
});

describe('coutCarburantEur', () => {
  it('km × conso × prix (base)', () => {
    // 1000 km, 0% surconso, 2 €/L : (9,5/100) × 2 × 1000 = 190 €
    expect(coutCarburantEur(1000, 0, PRIX_DIESEL_BASE)).toBeCloseTo(190, 5);
  });
  it('monte avec la surconsommation', () => {
    expect(coutCarburantEur(1000, 20, 2)).toBeCloseTo(228, 5);
  });
  it('km négatif borné à 0', () => {
    expect(coutCarburantEur(-500, 0, 2)).toBe(0);
  });
});

describe('avecMarge', () => {
  it('applique une marge en %', () => {
    expect(avecMarge(100, 20)).toBeCloseTo(120, 5);
    expect(avecMarge(190, 0)).toBe(190);
  });
});
