import { describe, expect, it } from 'vitest';
import { etatDe, filDepuisEtapes } from '@/lib/fil-itineraire';
import type { EtapeFige } from '@barjotur/shared';

function etape(jour: number, base_id: number | null, nuitee: string | null): EtapeFige {
  return {
    fige_id: 1,
    jour,
    aire_lat: null,
    aire_lon: null,
    stop_id: null,
    nuitee_type: nuitee,
    poi_osm_ids: null,
    tier_jour: null,
    roulage_min: null,
    meteo_dependant: null,
    repli: null,
    note: null,
    date_jour: `2027-08-0${jour}`,
    base_id,
    lever: null,
    coucher: null,
    circuit: null,
    resume_jour: base_id != null ? { camp_base: `Base ${base_id}` } : null,
  };
}

describe('etatDe', () => {
  it('passé/présent/futur', () => {
    expect(etatDe(1, 3)).toBe('visitee');
    expect(etatDe(3, 3)).toBe('courante');
    expect(etatDe(5, 3)).toBe('a_venir');
  });
});

describe('filDepuisEtapes', () => {
  const etapes = [
    etape(1, 1, 'autonomie'),
    etape(2, 1, 'payant'), // même base → même séjour
    etape(3, 2, 'autonomie'), // nouvelle base → nouveau séjour
    etape(4, 3, 'autonomie'),
  ];

  it('regroupe les journées consécutives au même camp de base', () => {
    const fil = filDepuisEtapes(etapes, 0);
    expect(fil.map((s) => s.base_id)).toEqual([1, 2, 3]);
    expect(fil[0]?.journees).toHaveLength(2);
    expect(fil[0]?.jourDebut).toBe(1);
    expect(fil[0]?.jourFin).toBe(2);
  });

  it('marque la nuit en autonomie vs payante', () => {
    const fil = filDepuisEtapes(etapes, 0);
    expect(fil[0]?.journees[0]?.nuitAutonomie).toBe(true);
    expect(fil[0]?.journees[1]?.nuitAutonomie).toBe(false); // payant
  });

  it('état du séjour selon le jour courant', () => {
    const fil = filDepuisEtapes(etapes, 3); // jour 3 = dans le 2e séjour (base 2)
    expect(fil[0]?.etat).toBe('visitee'); // jours 1-2 passés
    expect(fil[1]?.etat).toBe('courante'); // jour 3
    expect(fil[2]?.etat).toBe('a_venir'); // jour 4
  });

  it('état des journées dérivé du jour courant', () => {
    const fil = filDepuisEtapes(etapes, 2);
    expect(fil[0]?.journees[0]?.etat).toBe('visitee'); // jour 1
    expect(fil[0]?.journees[1]?.etat).toBe('courante'); // jour 2
  });
});
