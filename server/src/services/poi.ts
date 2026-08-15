// Service POI : catalogue votable (api.catalogue, 488 POI) et requête d'emprise (api.poi_in_bbox → GeoJSON).
// Ne connaît pas Express. Sert l'Explorer (T015, C). Lecture seule sur DB2.

import { appelerRpc, argFloat, argTexte, siRpcAbsente } from '../db/rpc.js';
import { Erreurs } from '../http/erreurs.js';
import type { CataloguePoi, FeatureCollection, PoiDetail, PhotoPoi, PoiFiche, Reco, RecosReponse } from '../domain/poi.js';
import { photosDuManifeste } from './photos-manifest.js';

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

/** Clé de fiche : osm_id (OSM entier, synthétique `bt:…`) ou `poi:<id>` (POI osm-less, A140). Bornée, pas d'injection. */
const CLE_MOTIF = /^[A-Za-z0-9:_-]{1,64}$/;

/** Valide la clé de fiche `:cle` (osm_id ou poi:<id>). Pure. 400 si vide/hors charset. */
export function validerCle(cle: unknown): string {
  if (typeof cle !== 'string' || !CLE_MOTIF.test(cle)) {
    throw Erreurs.requeteInvalide('Clé POI invalide. Attendu un osm_id ou "poi:<id>".');
  }
  return cle;
}

/**
 * Fiche POI (M405/A140) : détail (api.poi_detail, aligné poi.poi) + photos, chargée en lazy par C. Passe-plats dégradants :
 * détail absent (RPC pas encore posée) → `null` ; photos = RPC api.poi_photos (vue v_web_poi_photos au dump final) si
 * présente, sinon le MANIFESTE (data/echantillon-web, dev/validation), sinon `[]`. Jamais 500. `photos` injectable (test).
 */
export async function lirePoiFiche(
  cle: string,
  rpc = appelerRpc,
  photos = photosDuManifeste,
): Promise<PoiFiche> {
  const detail = await siRpcAbsente(rpc<PoiDetail | null>('poi_detail', [argTexte(cle)]), null);
  const photosRpc = await siRpcAbsente(rpc<PhotoPoi[] | null>('poi_photos', [argTexte(cle)]), null);
  return { detail: detail ?? null, photos: photosRpc ?? photos(cle) };
}

/** Recos personnalisées d'un voyageur (M379/M426) : top-N POI par SA valeur/appétit, en objets AUTOPORTANTS `Reco`
 *  (cle/nom/lat/lon/sous_zone_id/tier/rang) pour la couche animée + fitBounds sous-zone → fiche. Demandeur résolu par son
 *  `code` de lien (whoami côté RPC). Passe-plat de api.recos_voyageur ; rend `RecosReponse { recos:[] }` tant que la RPC
 *  n'est pas posée (dégradation), même shape qu'en prod → zéro re-câblage C au flip. */
export async function lireRecos(code: string, rpc = appelerRpc): Promise<RecosReponse> {
  const res = await siRpcAbsente(rpc<Reco[] | null>('recos_voyageur', [argTexte(code)]), null);
  return { recos: res ?? [] };
}
