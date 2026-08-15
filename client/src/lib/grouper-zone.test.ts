import { describe, expect, it } from 'vitest';
import type { CataloguePoi } from '@barjotur/shared';
import { grouperParZone, doitGrouper, SEUIL_LISTE_PLATE, ZONE_SANS } from './grouper-zone';

function poi(p: Partial<CataloguePoi> & { id: string }): CataloguePoi {
  return { nom: p.id, score_mcda: null, tier_defaut: null, region: null, ...p } as CataloguePoi;
}

describe('grouperParZone', () => {
  it('regroupe par region et trie les zones alphabétiquement (fr)', () => {
    const groupes = grouperParZone([
      poi({ id: 'a', region: 'Vestland' }),
      poi({ id: 'b', region: 'Innlandet' }),
      poi({ id: 'c', region: 'Vestland' }),
    ]);
    expect(groupes.map((g) => g.zone)).toEqual(['Innlandet', 'Vestland']);
    expect(groupes[1]?.pois.map((p) => p.id)).toEqual(['a', 'c']);
  });

  it('préserve l\'ordre d\'entrée dans une zone (tri amont conservé)', () => {
    const groupes = grouperParZone([
      poi({ id: 'x', region: 'Nord' }),
      poi({ id: 'y', region: 'Nord' }),
      poi({ id: 'z', region: 'Nord' }),
    ]);
    expect(groupes[0]?.pois.map((p) => p.id)).toEqual(['x', 'y', 'z']);
  });

  it('range les POI sans region dans « Ailleurs », en dernier', () => {
    const groupes = grouperParZone([poi({ id: 'sansZone' }), poi({ id: 'a', region: 'Agder' })]);
    expect(groupes.map((g) => g.zone)).toEqual(['Agder', ZONE_SANS]);
  });

  it('doitGrouper au-delà du seuil de liste plate seulement', () => {
    const court = Array.from({ length: SEUIL_LISTE_PLATE }, (_, i) => poi({ id: `p${i}` }));
    const long = Array.from({ length: SEUIL_LISTE_PLATE + 1 }, (_, i) => poi({ id: `p${i}` }));
    expect(doitGrouper(court)).toBe(false);
    expect(doitGrouper(long)).toBe(true);
  });
});
