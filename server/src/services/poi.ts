// Service POI : catalogue votable (api.catalogue, 488 POI) et requête d'emprise (api.poi_in_bbox → GeoJSON).
// Ne connaît pas Express. Sert l'Explorer (T015, C). Lecture seule sur DB2.

import { appelerRpc, argFloat } from '../db/rpc.js';
import { Erreurs } from '../http/erreurs.js';
import type { CataloguePoi, FeatureCollection } from '../domain/poi.js';

export interface Bbox {
  minlon: number;
  minlat: number;
  maxlon: number;
  maxlat: number;
}

function nombreFini(brut: unknown, nom: string): number {
  if (typeof brut !== 'string' || brut.trim() === '') {
    throw Erreurs.requeteInvalide(`Paramètre d'emprise manquant : ${nom}.`);
  }
  const n = Number(brut);
  if (!Number.isFinite(n)) {
    throw Erreurs.requeteInvalide(`Paramètre d'emprise non numérique : ${nom}.`);
  }
  return n;
}

/**
 * Analyse et valide une emprise (bbox) reçue en query string. Bornes WGS84, coin min strictement au sud-ouest
 * du coin max. Pure, testable sans DB.
 */
export function parseBbox(q: Record<string, unknown>): Bbox {
  const minlon = nombreFini(q.minlon, 'minlon');
  const minlat = nombreFini(q.minlat, 'minlat');
  const maxlon = nombreFini(q.maxlon, 'maxlon');
  const maxlat = nombreFini(q.maxlat, 'maxlat');
  if (minlon < -180 || maxlon > 180 || minlat < -90 || maxlat > 90) {
    throw Erreurs.requeteInvalide('Emprise hors bornes WGS84 (lon [-180,180], lat [-90,90]).');
  }
  if (minlon >= maxlon || minlat >= maxlat) {
    throw Erreurs.requeteInvalide('Emprise invalide : le coin min doit être au sud-ouest du coin max.');
  }
  return { minlon, minlat, maxlon, maxlat };
}

/** Catalogue des POI votables (488), objets riches. Passe-plat de api.catalogue. */
export async function lireCatalogue(): Promise<CataloguePoi[]> {
  return appelerRpc<CataloguePoi[]>('catalogue', []);
}

/** POI dans l'emprise, en FeatureCollection GeoJSON (carto + app). Passe-plat de api.poi_in_bbox. */
export async function lirePoiDansEmprise(b: Bbox): Promise<FeatureCollection> {
  return appelerRpc<FeatureCollection>('poi_in_bbox', [
    argFloat(b.minlon),
    argFloat(b.minlat),
    argFloat(b.maxlon),
    argFloat(b.maxlat),
  ]);
}
