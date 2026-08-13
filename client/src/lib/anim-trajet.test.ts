import { describe, it, expect } from 'vitest';
import type { LineString, MultiLineString } from 'geojson';
import {
  modeleAnimationFigeGeom,
  positionAuTemps,
  segmentsTerrestresTropLongs,
  type EtapeEntree,
} from './anim-trajet';

// fige.geom de reference : deux troncons routes terrestres (pas courts ~1 km), separes par une
// TRAVERSEE d'eau (saut ~60 km, type ferry/base-ile). C'est exactement le cas que le rendu strict
// doit honorer : concatener dans l'ordre, marquer la traversee tiretee, sans jamais fabriquer de
// droite terrestre.
const figeReference: MultiLineString = {
  type: 'MultiLineString',
  coordinates: [
    [
      [8.0, 58.0],
      [8.01, 58.005],
      [8.02, 58.01],
    ],
    [
      // Depart de ce troncon LOIN du precedent : franchissement d'eau assume.
      [8.5, 58.3],
      [8.51, 58.305],
      [8.52, 58.31],
    ],
  ],
};

describe('modeleAnimationFigeGeom (rendu strict fige.geom)', () => {
  it('concatene les troncons DANS L ORDRE livre (pas de reorientation, pas de teleport)', () => {
    const m = modeleAnimationFigeGeom(figeReference);
    // 6 points au total (3 + 3), aucune deduplication ici (les troncons ne se touchent pas).
    expect(m.pts.length).toBe(6);
    // Premier point = premier sommet du premier troncon, en [lat, lng].
    expect(m.pts[0]).toEqual([58.0, 8.0]);
    // Dernier point = dernier sommet du dernier troncon.
    expect(m.pts[m.pts.length - 1]).toEqual([58.31, 8.52]);
  });

  it('marque la jonction entre troncons comme TRAVERSEE (liaison, tiretee)', () => {
    const m = modeleAnimationFigeGeom(figeReference);
    // Le 4e point (index 3) est le debut du 2e troncon, atteint par un grand saut d'eau.
    expect(m.nature[3]).toBe('liaison');
    // Les points internes d'un troncon terrestre restent 'boucle'.
    expect(m.nature[1]).toBe('boucle');
    expect(m.nature[5]).toBe('boucle');
  });

  it('temps cumule monotone non decroissant, normalise sur total', () => {
    const m = modeleAnimationFigeGeom(figeReference);
    for (let i = 1; i < m.cum.length; i++) {
      expect(m.cum[i]!).toBeGreaterThanOrEqual(m.cum[i - 1]!);
    }
    expect(m.cum[m.cum.length - 1]).toBeCloseTo(m.total, 10);
    expect(m.nature.length).toBe(m.pts.length);
  });

  it('PREUVE gate : 0 segment terrestre > 5 km hors traversee sur une geom propre', () => {
    const m = modeleAnimationFigeGeom(figeReference);
    expect(segmentsTerrestresTropLongs(m, 5)).toBe(0);
  });

  it('accepte une LineString simple et une Feature (memes cas que fige.geom)', () => {
    const ls: LineString = { type: 'LineString', coordinates: [[8, 58], [8.01, 58.01]] };
    expect(modeleAnimationFigeGeom(ls).pts.length).toBe(2);
    const feat = { type: 'Feature' as const, properties: {}, geometry: ls };
    expect(modeleAnimationFigeGeom(feat).pts.length).toBe(2);
  });

  it('geom vide ou absente -> modele vide, jamais d exception', () => {
    expect(modeleAnimationFigeGeom(null).pts.length).toBe(0);
    expect(modeleAnimationFigeGeom({ type: 'MultiLineString', coordinates: [] }).pts.length).toBe(0);
  });
});

describe('segmentsTerrestresTropLongs (detecteur de droite bug)', () => {
  it('DETECTE une droite terrestre longue au sein d un troncon (l ancien bug)', () => {
    // Un troncon unique avec un grand saut interne : pas une traversee (reste 'boucle'), donc suspect.
    const droite: LineString = {
      type: 'LineString',
      coordinates: [
        [8.0, 58.0],
        [8.01, 58.01],
        [9.5, 58.8], // saut terrestre ~110 km en plein milieu d'un troncon route
      ],
    };
    const m = modeleAnimationFigeGeom(droite);
    expect(segmentsTerrestresTropLongs(m, 5)).toBeGreaterThan(0);
  });
});

describe('positionAuTemps (interpolation par le TEMPS)', () => {
  it('t=0 -> premier point ; t=total -> dernier point', () => {
    const m = modeleAnimationFigeGeom(figeReference);
    expect(positionAuTemps(m, 0)).toEqual([58.0, 8.0]);
    expect(positionAuTemps(m, m.total)).toEqual([58.31, 8.52]);
  });

  it('borne les temps hors intervalle', () => {
    const m = modeleAnimationFigeGeom(figeReference);
    expect(positionAuTemps(m, -1)).toEqual([58.0, 8.0]);
    expect(positionAuTemps(m, m.total + 10)).toEqual([58.31, 8.52]);
  });
});

describe('projection des etapes', () => {
  it('projette une etape sur le point le plus proche et cale son temps dans [0,1]', () => {
    const etapes: EtapeEntree[] = [
      { ordre: 1, nom: 'Base A', nuits: 2, date: '2027-08-05', type: 'base', coord: [8.02, 58.01] },
    ];
    const m = modeleAnimationFigeGeom(figeReference, etapes);
    expect(m.etapes.length).toBe(1);
    const e = m.etapes[0]!;
    // Coord fournie : ll = [lat, lng].
    expect(e.ll).toEqual([58.01, 8.02]);
    expect(e.pos).toBeGreaterThanOrEqual(0);
    expect(e.pos).toBeLessThanOrEqual(1);
  });
});
