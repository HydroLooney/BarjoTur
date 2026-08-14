import { describe, expect, it } from 'vitest';
import { enviePourZone, libelleTheme, trierZonesParEnvie } from '@/lib/zones';
import type { ZoneActiviteIdeale } from '@barjotur/shared';

function z(zone: string, theme: string): ZoneActiviteIdeale {
  return { zone, theme, source: { guide: 'g' } };
}

describe('enviePourZone', () => {
  it('renvoie l’appétit du thème, 0 si absent', () => {
    expect(enviePourZone(z('A', 'nautique'), { nautique: 0.8 })).toBe(0.8);
    expect(enviePourZone(z('B', 'faune'), { nautique: 0.8 })).toBe(0);
  });
});

describe('trierZonesParEnvie', () => {
  it('remonte les zones aux thèmes désirés en premier', () => {
    const zones = [z('A', 'patrimoine'), z('B', 'nautique'), z('C', 'faune')];
    const out = trierZonesParEnvie(zones, { nautique: 0.9, faune: 0.4 });
    expect(out.map((x) => x.zone)).toEqual(['B', 'C', 'A']);
  });
  it('préserve l’ordre à égalité (tri stable)', () => {
    const zones = [z('A', 'x'), z('B', 'y'), z('C', 'z')];
    expect(trierZonesParEnvie(zones, {}).map((x) => x.zone)).toEqual(['A', 'B', 'C']);
  });
});

describe('libelleTheme', () => {
  it('libellé connu ou repli brut', () => {
    expect(libelleTheme('faune')).toBe('faune et animaux');
    expect(libelleTheme('inconnu')).toBe('inconnu');
  });
});
