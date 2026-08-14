import { describe, expect, it } from 'vitest';
import type { ArretTransit } from '@barjotur/shared';
import { basculerAutonomie, libelleArret, nouvelleEtapeTransit } from './transit';

function arret(p: Partial<ArretTransit>): ArretTransit {
  return { id: 'x', label: 'X', lat: 0, lon: 0, epingle: false, reserve: false, autonomie: true, ...p };
}

describe('libelleArret', () => {
  it('réservé prime sur épinglé', () => {
    expect(libelleArret(arret({ reserve: true, epingle: true }))).toBe('réservé');
  });
  it('épinglé sinon', () => {
    expect(libelleArret(arret({ epingle: true }))).toBe('épinglé');
  });
  it('autonomie / payant selon le drapeau', () => {
    expect(libelleArret(arret({ autonomie: true }))).toBe('autonomie');
    expect(libelleArret(arret({ autonomie: false }))).toBe('payant');
  });
});

describe('nouvelleEtapeTransit', () => {
  it('crée une étape vierge au bon ordre, faisceau vide', () => {
    const p = { label: 'A', lat: 1, lon: 2 };
    const q = { label: 'B', lat: 3, lon: 4 };
    const e = nouvelleEtapeTransit(3, p, q);
    expect(e.ordre).toBe(3);
    expect(e.depuis).toEqual(p);
    expect(e.vers).toEqual(q);
    expect(e.jalon_date).toBeNull();
    expect(e.faisceau).toEqual([]);
  });
});

describe('basculerAutonomie', () => {
  it('bascule un arrêt non réservé', () => {
    const f = [arret({ id: 'a', autonomie: true })];
    expect(basculerAutonomie(f, 'a')[0]?.autonomie).toBe(false);
  });
  it('laisse un arrêt réservé inchangé', () => {
    const f = [arret({ id: 'a', reserve: true, autonomie: false })];
    expect(basculerAutonomie(f, 'a')[0]?.autonomie).toBe(false);
  });
});
