import { describe, it, expect } from 'vitest';
import { lireCodeLien } from './identite-url';

describe('lireCodeLien', () => {
  it('extrait le code de /app/<code>/<Prenom>', () => {
    expect(lireCodeLien('/app/AB12/Guillaume')).toBe('AB12');
  });
  it('ignore la suite du chemin', () => {
    expect(lireCodeLien('/app/AB12/Guillaume/explorer')).toBe('AB12');
  });
  it('decode le code encode', () => {
    expect(lireCodeLien('/app/AB%2012/Guillaume')).toBe('AB 12');
  });
  it('retourne null hors du schema /app', () => {
    expect(lireCodeLien('/explorer')).toBeNull();
    expect(lireCodeLien('/')).toBeNull();
  });
  it('retourne null si le code manque apres /app', () => {
    expect(lireCodeLien('/app/')).toBeNull();
    expect(lireCodeLien('/app')).toBeNull();
  });
});
