// POI pour l'Explorer (T015) : le catalogue votable (api.catalogue) et la requête d'emprise (api.poi_in_bbox).
//
// PONT PROVISOIRE pour `CataloguePoi` : api.catalogue rend un objet riche (~30 champs). On type ici le noyau
// utile au front, l'index signature tolère le reste (passe-plat). À canoniser dans @barjotur/shared/poi.ts
// (demande postée à M). Le socle `Poi` existant est un sous-ensemble (id/nom/tier/votable/provenance/geom).
//
// Pour l'emprise, on réutilise `FeatureCollection` du socle (api.poi_in_bbox rend une FeatureCollection GeoJSON).

import type { FeatureCollection } from '@barjotur/shared';

export type { FeatureCollection };

/** Un POI du catalogue votable (api.catalogue). Noyau typé + tolérance passe-plat sur les champs annexes. */
export interface CataloguePoi {
  /** osm_id (entier OSM ou slug vault) : clé de jointure. */
  id: string;
  nom: string;
  region: string | null;
  categorie: string | null;
  sous_categorie: string | null;
  lat: number;
  lon: number;
  tier_defaut: string | null;
  votable: boolean;
  payant: boolean | null;
  score_mcda: number | null;
  score_interet: number | null;
  temps_visite: number | null;
  image: string | null;
  photos: unknown[];
  presentation: string | null;
  /** Champs annexes du passe-plat (geometrie, url, saison, parking, honeypot, ...). */
  [autre: string]: unknown;
}
