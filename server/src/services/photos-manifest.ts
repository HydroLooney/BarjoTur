// Manifeste photos (M405/A140) : source des photos de fiche AVANT le dump final (où la vue v_web_poi_photos + la RPC
// api.poi_photos prennent le relais). Le fichier data/echantillon-web/photos-manifest.json agrège 318 POI → 685 images.
// Ce module l'INDEXE (cœur pur, testable) et le charge une fois (cache), pour que le service fiche serve les photos par
// clé. Chemin du fichier via l'env PHOTOS_MANIFEST_PATH (dev/validation) ; absent en prod = 0 photo ici (la RPC les sert).

import { readFileSync } from 'node:fs';
import type { PhotoPoi } from '../domain/poi.js';

interface EntreeManifeste {
  cle?: unknown;
  osm_id?: unknown;
  osm_id_valide?: unknown;
  photos?: unknown;
}

/** Vrai osm_id (indexable) : non vide, distinct du sentinelle '-1' des POI osm-less (A140). */
function osmIdIndexable(osm_id: unknown): osm_id is string {
  return typeof osm_id === 'string' && osm_id !== '' && osm_id !== '-1';
}

/**
 * Indexe le manifeste en Map `clé → PhotoPoi[]` (triées par `ordre`). Chaque POI est indexé par sa `cle` ET, si l'osm_id
 * est réel, par son osm_id (les deux pointent la même liste) → une fiche ouverte par osm_id OU par cle trouve ses photos.
 * PUR, tolérant : entrée absente/malformée → Map vide (jamais d'exception ; le service dégrade proprement).
 */
export function indexerManifeste(manifeste: unknown): Map<string, PhotoPoi[]> {
  const idx = new Map<string, PhotoPoi[]>();
  const pois = (manifeste as { pois?: unknown } | null)?.pois;
  if (!Array.isArray(pois)) return idx;
  for (const brut of pois as EntreeManifeste[]) {
    if (!Array.isArray(brut?.photos)) continue;
    const photos = [...(brut.photos as PhotoPoi[])].sort((a, b) => (a?.ordre ?? 0) - (b?.ordre ?? 0));
    if (typeof brut.cle === 'string' && brut.cle !== '') idx.set(brut.cle, photos);
    if (osmIdIndexable(brut.osm_id)) idx.set(brut.osm_id, photos);
  }
  return idx;
}

// --- Chargement disque (impur, isolé + mémoïsé) ---------------------------------------------------

let cache: Map<string, PhotoPoi[]> | null = null;

/** Charge et indexe le manifeste depuis `chemin` (ou l'env PHOTOS_MANIFEST_PATH). Mémoïsé. Fichier absent/illisible →
 *  Map vide (dégradation : la fiche rend `photos:[]`, jamais 500). */
export function chargerManifeste(chemin = process.env.PHOTOS_MANIFEST_PATH): Map<string, PhotoPoi[]> {
  if (cache) return cache;
  if (!chemin) return (cache = new Map());
  try {
    cache = indexerManifeste(JSON.parse(readFileSync(chemin, 'utf8')));
  } catch {
    cache = new Map(); // fichier absent/illisible/malformé → dégradation silencieuse (contrat de prod : la RPC sert les photos)
  }
  return cache;
}

/** Photos d'un POI depuis le manifeste chargé (par cle ou osm_id). [] si inconnu. */
export function photosDuManifeste(cle: string): PhotoPoi[] {
  return chargerManifeste().get(cle) ?? [];
}
