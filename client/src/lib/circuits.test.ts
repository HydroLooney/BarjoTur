import { describe, expect, it } from 'vitest';
import { filtrerCircuits, libelleDuree, zonesDisponibles } from '@/lib/circuits';
import { circuitsDemo } from '@/lib/fixtures/circuits-demo';

describe('filtrerCircuits', () => {
  it('sans filtre, renvoie tout', () => {
    expect(filtrerCircuits(circuitsDemo, {})).toHaveLength(circuitsDemo.length);
  });
  it('filtre par zone', () => {
    const out = filtrerCircuits(circuitsDemo, { zone: 'Vestland' });
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((c) => c.zone === 'Vestland')).toBe(true);
  });
  it('filtre par durée', () => {
    const out = filtrerCircuits(circuitsDemo, { duree: 'journee' });
    expect(out.every((c) => c.duree === 'journee')).toBe(true);
  });
  it('filtre par mode d’origine', () => {
    const out = filtrerCircuits(circuitsDemo, { mode: 'pied' });
    expect(out.every((c) => c.mode_origine === 'pied')).toBe(true);
  });
  it('combine les critères', () => {
    const out = filtrerCircuits(circuitsDemo, { zone: 'Vestland', duree: 'journee' });
    expect(out.every((c) => c.zone === 'Vestland' && c.duree === 'journee')).toBe(true);
  });
});

describe('zonesDisponibles', () => {
  it('renvoie les zones distinctes triées', () => {
    const z = zonesDisponibles(circuitsDemo);
    expect(z).toContain('Lysefjord');
    expect(z).toContain('Vestland');
    expect([...z]).toEqual([...z].sort((a, b) => a.localeCompare(b, 'fr')));
  });
});

describe('libelleDuree', () => {
  it('nombre de jours si connu', () => {
    expect(libelleDuree({ nom: 'x', source: { guide: 'g' }, mode_origine: 'train', duree: 'jours', jours: 3, etapes: [] })).toBe('3 jours');
  });
  it('grain sinon', () => {
    expect(libelleDuree({ nom: 'x', source: { guide: 'g' }, mode_origine: 'voiture', duree: '24h', etapes: [] })).toBe('24 h');
  });
});
