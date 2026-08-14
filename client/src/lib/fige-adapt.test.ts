import { describe, expect, it } from 'vitest';
import type { EtapeFige, FigeDetail } from '@barjotur/shared';
import { etapesDepuisFige } from './fige-adapt';

// Fabrique une étape figée minimale (seuls les champs lus par l'adaptateur comptent).
function etape(p: Partial<EtapeFige>): EtapeFige {
  return {
    fige_id: 1,
    jour: 1,
    aire_lat: null,
    aire_lon: null,
    stop_id: null,
    nuitee_type: null,
    poi_osm_ids: null,
    tier_jour: null,
    roulage_min: null,
    meteo_dependant: null,
    repli: null,
    note: null,
    date_jour: null,
    base_id: null,
    lever: null,
    coucher: null,
    circuit: null,
    resume_jour: null,
    ...p,
  };
}

function detail(etapes: EtapeFige[]): FigeDetail {
  return { itineraire: {} as FigeDetail['itineraire'], geom: {} as FigeDetail['geom'], etapes, waypoints: [] };
}

describe('etapesDepuisFige', () => {
  it('reporte ordre, nuits=1, date et type depuis la nuitée', () => {
    const [e] = etapesDepuisFige(detail([etape({ jour: 3, nuitee_type: 'aire', date_jour: '2027-08-07' })]));
    expect(e).toEqual({ ordre: 3, nom: 'aire', nuits: 1, date: '2027-08-07', type: 'aire', coord: null });
  });

  it('nomme « Jour N » quand la nuitée est absente, et laisse type indéfini', () => {
    const [e] = etapesDepuisFige(detail([etape({ jour: 5 })]));
    expect(e?.nom).toBe('Jour 5');
    expect(e?.type).toBeUndefined();
  });

  it('pose la coord [lon, lat] quand l’aire est connue', () => {
    const [e] = etapesDepuisFige(detail([etape({ aire_lon: 10.5, aire_lat: 63.2 })]));
    expect(e?.coord).toEqual([10.5, 63.2]);
  });

  it('laisse coord null si une des deux coordonnées manque', () => {
    const [sansLat] = etapesDepuisFige(detail([etape({ aire_lon: 10.5, aire_lat: null })]));
    const [sansLon] = etapesDepuisFige(detail([etape({ aire_lon: null, aire_lat: 63.2 })]));
    expect(sansLat?.coord).toBeNull();
    expect(sansLon?.coord).toBeNull();
  });

  it('gère une liste vide', () => {
    expect(etapesDepuisFige(detail([]))).toEqual([]);
  });
});
