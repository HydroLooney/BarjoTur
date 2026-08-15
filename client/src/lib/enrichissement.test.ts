import { describe, expect, it } from 'vitest';
import { estPerle, libelleAire, nbCommunautes, origineGuide, totalCitations } from '@/lib/enrichissement';
import type { PoiEnrichissement, SignalCommunaute } from '@barjotur/shared';

const signaux: SignalCommunaute[] = [
  { aire_langue: 'scandinave', n_sources: 3, endossement: 0.8, perle: false },
  { aire_langue: 'nl_de', n_sources: 2, endossement: 0.6, perle: true },
  { aire_langue: 'fr_be', n_sources: 0, endossement: 0, perle: false },
];

describe('enrichissement', () => {
  it('libelleAire connu et repli', () => {
    expect(libelleAire('nl_de')).toBe('néerlandaise et allemande');
    expect(libelleAire('xx')).toBe('xx');
  });
  it('nbCommunautes = aires avec au moins une source', () => {
    expect(nbCommunautes(signaux)).toBe(2);
    expect(nbCommunautes([])).toBe(0);
    expect(nbCommunautes(undefined)).toBe(0);
  });
  it('totalCitations = somme des sources', () => {
    expect(totalCitations(signaux)).toBe(5);
  });
  it('estPerle si une aire est perle', () => {
    expect(estPerle(signaux)).toBe(true);
    expect(estPerle([{ aire_langue: 'anglophone', n_sources: 1, endossement: 0.3, perle: false }])).toBe(false);
  });
  it('origineGuide = source du canal guide_papier', () => {
    const enr: PoiEnrichissement = {
      poi_id: 1,
      provenance: [
        { canal: 'base_v2', source: 'v2', n_sources: 1 },
        { canal: 'guide_papier', source: 'Guide Coup de Cœur, p. 12', n_sources: 1 },
      ],
    };
    expect(origineGuide(enr)).toBe('Guide Coup de Cœur, p. 12');
    expect(origineGuide({ poi_id: 2 })).toBeNull();
    expect(origineGuide(null)).toBeNull();
  });
});
