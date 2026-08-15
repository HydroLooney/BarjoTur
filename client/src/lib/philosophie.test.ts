import { describe, expect, it } from 'vitest';
import { AXES_PHILO, philoDefaut, resumeAxe, syntheseHumaine } from './philosophie';

describe('philosophie', () => {
  it('a 8 axes avec clés MCDA uniques', () => {
    expect(AXES_PHILO).toHaveLength(8);
    const cles = AXES_PHILO.map((a) => a.cle);
    expect(new Set(cles).size).toBe(8);
    expect(cles).toContain('interet');
    expect(cles).toContain('mobilite');
  });

  it('défaut = milieu (50) sur chaque axe', () => {
    const d = philoDefaut();
    expect(Object.values(d).every((v) => v === 50)).toBe(true);
  });

  it('resumeAxe choisit bas/milieu/haut selon la position', () => {
    const axe = AXES_PHILO[0]!;
    expect(resumeAxe(axe, 10)).toBe(axe.resume[0]);
    expect(resumeAxe(axe, 50)).toBe(axe.resume[1]);
    expect(resumeAxe(axe, 90)).toBe(axe.resume[2]);
  });

  it('syntheseHumaine ignore les axes proches du milieu', () => {
    expect(syntheseHumaine(philoDefaut())).toMatch(/équilibré/);
    const marque = { ...philoDefaut(), interet: 95 };
    expect(syntheseHumaine(marque)).toMatch(/beauté avant tout/);
  });
});
