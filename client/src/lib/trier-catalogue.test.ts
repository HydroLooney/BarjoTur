import { describe, expect, it } from 'vitest';
import type { CataloguePoi } from '@barjotur/shared';
import { trierCatalogue } from './trier-catalogue';

function poi(p: Partial<CataloguePoi> & { id: string; nom: string }): CataloguePoi {
  return { score_mcda: null, tier_defaut: null, ...p } as CataloguePoi;
}

describe('trierCatalogue', () => {
  it('recommandes : score decroissant, defauts (sans score) en dernier', () => {
    const items = trierCatalogue(
      [poi({ id: 'a', nom: 'A', score_mcda: 0.3 }), poi({ id: 'b', nom: 'B', score_mcda: 0.9 }), poi({ id: 'c', nom: 'C' })],
      'recommandes',
    );
    expect(items.map((i) => i.id)).toEqual(['b', 'a', 'c']);
  });

  it('recommandes : sans score, retombe sur le rang d’avis T>S>A>B', () => {
    const items = trierCatalogue(
      [poi({ id: 'b', nom: 'B', tier_defaut: 'B' }), poi({ id: 't', nom: 'T', tier_defaut: 'T' }), poi({ id: 'a', nom: 'A', tier_defaut: 'A' })],
      'recommandes',
    );
    expect(items.map((i) => i.id)).toEqual(['t', 'a', 'b']);
  });

  it('nom : tri alphabetique fr, insensible a l’ordre d’entree', () => {
    const items = trierCatalogue([poi({ id: '2', nom: 'Ålesund' }), poi({ id: '1', nom: 'Bergen' })], 'nom');
    expect(items.map((i) => i.nom)).toEqual(['Ålesund', 'Bergen']);
  });

  it('ne mute pas la liste d’entree', () => {
    const src = [poi({ id: 'a', nom: 'A', score_mcda: 0.1 }), poi({ id: 'b', nom: 'B', score_mcda: 0.9 })];
    trierCatalogue(src, 'recommandes');
    expect(src.map((i) => i.id)).toEqual(['a', 'b']);
  });
});
