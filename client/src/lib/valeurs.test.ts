import { describe, it, expect } from 'vitest';
import { clampValeur } from './valeurs';

describe('clampValeur', () => {
  it('laisse une valeur dans les bornes', () => {
    expect(clampValeur(5, 0, 10)).toBe(5);
  });
  it('borne en bas et en haut', () => {
    expect(clampValeur(-3, 0, 10)).toBe(0);
    expect(clampValeur(13, 0, 10)).toBe(10);
  });
  it('cale sur le pas entier', () => {
    expect(clampValeur(2.4, 0, 10, 1)).toBe(2);
    expect(clampValeur(2.6, 0, 10, 1)).toBe(3);
  });
  it('cale sur un pas fractionnaire sans erreur de flottant', () => {
    expect(clampValeur(2.3, 0, 10, 0.5)).toBe(2.5);
    expect(clampValeur(0.1 + 0.2, 0, 1, 0.1)).toBe(0.3);
  });
  it('NaN retombe sur min', () => {
    expect(clampValeur(Number.NaN, 2, 8)).toBe(2);
  });
  it('pas <= 0 : borne sans caler', () => {
    expect(clampValeur(3.14159, 0, 10, 0)).toBe(3.14159);
  });
});
