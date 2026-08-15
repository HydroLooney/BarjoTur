import { describe, expect, it } from 'vitest';
import type { CataloguePoi } from '@barjotur/shared';
import { construireRails, railFamille, railIncontournables, railPepites, railPourChacun } from './recommandations';

function poi(p: Partial<CataloguePoi> & { id: string }): CataloguePoi {
  return { nom: p.id, score_mcda: null, tier_defaut: null, ...p } as CataloguePoi;
}

describe('railIncontournables', () => {
  it('trie par score_mcda quand présent, avec le pourquoi chiffré', () => {
    const items = railIncontournables([poi({ id: 'a', score_mcda: 0.5 }), poi({ id: 'b', score_mcda: 0.9 })]);
    expect(items.map((i) => i.poi.id)).toEqual(['b', 'a']);
    expect(items[0]?.pourquoi).toMatch(/90\/100/);
  });
  it('replie sur les tiers majeurs T/S sans score', () => {
    const items = railIncontournables([poi({ id: 't', tier_defaut: 'T' }), poi({ id: 'b', tier_defaut: 'B' })]);
    expect(items.map((i) => i.poi.id)).toEqual(['t']);
    // Langage humain à l'écran, jamais le cran technique « tier » (R7 / M182).
    expect(items[0]?.pourquoi).toMatch(/incontournable/);
    expect(items[0]?.pourquoi).not.toMatch(/tier/);
  });
});

describe('railFamille', () => {
  it('ne garde que le tier A', () => {
    expect(railFamille([poi({ id: 'a', tier_defaut: 'A' }), poi({ id: 'b', tier_defaut: 'B' })]).map((i) => i.poi.id)).toEqual(['a']);
  });
});

describe('railPepites', () => {
  it('ne garde que les pépites signalées', () => {
    const items = railPepites([poi({ id: 'p', flag_pepite: true }), poi({ id: 'n', flag_pepite: false }), poi({ id: 'x' })]);
    expect(items.map((i) => i.poi.id)).toEqual(['p']);
  });
});

describe('railPourChacun', () => {
  it('garde les POI que j’ai votés T/S/A et dit lequel', () => {
    const items = railPourChacun([poi({ id: 'a' }), poi({ id: 'b' })], { 'p:a': 'S', 'p:b': 'B' });
    expect(items.map((i) => i.poi.id)).toEqual(['a']);
    // Libellé humain de l'avis (AVIS['S']), pas le cran brut (R7 / M182).
    expect(items[0]?.pourquoi).toMatch(/Vraiment envie/);
  });
});

describe('construireRails', () => {
  it('omet les rails vides', () => {
    const rails = construireRails([poi({ id: 'a', tier_defaut: 'A' })], {});
    expect(rails.map((r) => r.cle)).toEqual(['famille']);
  });
});
