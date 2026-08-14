import { describe, expect, it } from 'vitest';
import { profilsDepuisParametres } from '@/lib/profils';
import type { Parametre } from '@/lib/queries/parametres';

function p(domaine: string, cle: string): Parametre {
  return { cle, valeur: 1, valeur_recommandee: null, source: 'defaut', justification: '', domaine };
}

describe('profilsDepuisParametres', () => {
  it('regroupe par mode selon le domaine « Profil * »', () => {
    const out = profilsDepuisParametres([
      p('Profil van', 'poids_max_t'),
      p('Profil van', 'peages'),
      p('Profil rando', 'modele_effort'),
    ]);
    expect(out).toHaveLength(2);
    const van = out.find((x) => x.mode === 'van');
    expect(van?.params).toHaveLength(2);
  });

  it('marque le van gelé, les autres non', () => {
    const out = profilsDepuisParametres([p('Profil van', 'a'), p('Profil à pied', 'b')]);
    expect(out.find((x) => x.mode === 'van')?.gele).toBe(true);
    expect(out.find((x) => x.mode === 'pieton')?.gele).toBe(false);
  });

  it('ignore les paramètres hors domaine profil', () => {
    const out = profilsDepuisParametres([p('Budget', 'overhead'), p('Temps', 'marge')]);
    expect(out).toEqual([]);
  });

  it('rend les modes dans l’ordre van → à pied → rando → transports', () => {
    const out = profilsDepuisParametres([
      p('Profil transports', 'a'),
      p('Profil rando', 'b'),
      p('Profil à pied', 'c'),
      p('Profil van', 'd'),
    ]);
    expect(out.map((x) => x.mode)).toEqual(['van', 'pieton', 'rando', 'tc']);
  });

  it('reconnaît « piéton », « transport » et « tc » comme modes', () => {
    const out = profilsDepuisParametres([p('Profil piéton', 'a'), p('Profil transport', 'b')]);
    expect(out.map((x) => x.mode).sort()).toEqual(['pieton', 'tc']);
  });

  it('renvoie une liste vide sans profil dans le registre', () => {
    expect(profilsDepuisParametres([])).toEqual([]);
  });
});
