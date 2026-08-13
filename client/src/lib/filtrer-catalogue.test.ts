import { describe, it, expect } from 'vitest';
import type { CataloguePoi } from '@barjotur/shared';
import { filtrerCatalogue, categoriesDisponibles, normaliserTexte } from './filtrer-catalogue';

// Fabrique un CataloguePoi minimal (champs requis) surchargeable pour les tests.
function poi(over: Partial<CataloguePoi>): CataloguePoi {
  return {
    id: 'osm1',
    nom: 'Lieu',
    region: null,
    region_id: null,
    zone_id: null,
    categorie: null,
    sous_categorie: null,
    score_interet: null,
    score_frequentation: null,
    score_mcda: null,
    temps_visite: null,
    lat: 60,
    lon: 8,
    geometrie: null,
    trace_reelle: null,
    description_a_rediger: null,
    verifie: null,
    tier_defaut: null,
    tier_defaut_source: null,
    honeypot: null,
    cruise_expose: null,
    payant: null,
    tarif: null,
    saison: null,
    parking: null,
    votable: true,
    exclu: null,
    motif_exclusion: null,
    hors_emprise: null,
    presentation: null,
    description: null,
    page_guide: null,
    provenance: null,
    url: null,
    image: null,
    photos: [],
    ...over,
  };
}

describe('normaliserTexte', () => {
  it('retire accents et casse', () => {
    expect(normaliserTexte('Préikestolen')).toBe('preikestolen');
    expect(normaliserTexte('  ÎLE  ')).toBe('ile');
  });
});

describe('filtrerCatalogue', () => {
  const pois = [
    poi({ id: 'a', nom: 'Preikestolen', categorie: 'rando', tier_defaut: 'T', votable: true }),
    poi({ id: 'b', nom: 'Restaurant du fjord', categorie: 'manger', tier_defaut: null, votable: false }),
    poi({ id: 'c', nom: 'Cascade de Voringsfossen', categorie: 'nature', tier_defaut: 'S', votable: true }),
    poi({ id: 'd', nom: 'Bar exclu', categorie: 'boire', votable: true, exclu: true }),
  ];
  const base = { recherche: '', categorie: null, tier: null, votableSeul: false };

  it('exclut toujours les POI marques exclu', () => {
    const r = filtrerCatalogue(pois, base);
    expect(r.find((p) => p.id === 'd')).toBeUndefined();
    expect(r).toHaveLength(3);
  });
  it('votableSeul retire les non-votables', () => {
    const r = filtrerCatalogue(pois, { ...base, votableSeul: true });
    expect(r.map((p) => p.id)).toEqual(['a', 'c']);
  });
  it('filtre par categorie', () => {
    const r = filtrerCatalogue(pois, { ...base, categorie: 'rando' });
    expect(r.map((p) => p.id)).toEqual(['a']);
  });
  it('filtre par tier_defaut', () => {
    const r = filtrerCatalogue(pois, { ...base, tier: 'S' });
    expect(r.map((p) => p.id)).toEqual(['c']);
  });
  it('recherche insensible aux accents sur le nom', () => {
    const r = filtrerCatalogue(pois, { ...base, recherche: 'voringsfossen' });
    expect(r.map((p) => p.id)).toEqual(['c']);
  });
  it('combine plusieurs facettes', () => {
    const r = filtrerCatalogue(pois, { ...base, votableSeul: true, recherche: 'preik' });
    expect(r.map((p) => p.id)).toEqual(['a']);
  });
});

describe('categoriesDisponibles', () => {
  it('liste triee et dedupliquee, sans null', () => {
    const pois = [
      poi({ categorie: 'nature' }),
      poi({ categorie: 'rando' }),
      poi({ categorie: 'nature' }),
      poi({ categorie: null }),
    ];
    expect(categoriesDisponibles(pois)).toEqual(['nature', 'rando']);
  });
});
