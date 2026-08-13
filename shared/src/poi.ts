import type { PointGeom, Geometry } from './geo.js';

// Contrat POI, aligné sur la table pivot `poi.poi` (DB1/DB2), cf docs/reviews/R01-R02.

/** Tiers provisoire TSAB, du meilleur (T) au plus commun (B). Dérivé canonique, cf A14. */
export type Tier = 'T' | 'S' | 'A' | 'B';

/** Provenance de la donnée. 'voyageur' = ajout perso, confiance basse, promouvable ensuite. */
export type Provenance = 'source' | 'voyageur';

export interface Poi {
  /** poi.poi.poi_id */
  id: number;
  nom: string;
  /** tier_defaut ; null = dette TSAB à recalculer (676 POI concernés à l'audit). */
  tier: Tier | null;
  votable: boolean;
  provenance: Provenance;
  /** Niveau de confiance dans [0,1], pondère les signaux dérivés. */
  confiance: number;
  /** Dédup : id du POI cible si celui-ci a été fusionné, sinon null. */
  mergedIntoPoiId: number | null;
  geom: PointGeom;
}

/**
 * POI du catalogue votable, passe-plat de `api.catalogue` (~36 champs, relevés par B, B013).
 * Noyau typé + index signature pour tolérer les champs annexes sans les figer. Clé `id` = osm_id (texte).
 */
export interface CataloguePoi {
  id: string;
  nom: string;
  region: string | null;
  region_id: number | null;
  zone_id: number | null;
  categorie: string | null;
  sous_categorie: string | null;
  score_interet: number | null;
  score_frequentation: number | null;
  score_mcda: number | null;
  temps_visite: number | null;
  lat: number;
  lon: number;
  geometrie: Geometry | null;
  trace_reelle: boolean | null;
  description_a_rediger: boolean | null;
  verifie: boolean | null;
  tier_defaut: string | null;
  tier_defaut_source: string | null;
  honeypot: boolean | null;
  cruise_expose: boolean | null;
  payant: boolean | null;
  tarif: string | null;
  saison: string | null;
  parking: string | null;
  votable: boolean;
  exclu: boolean | null;
  motif_exclusion: string | null;
  hors_emprise: boolean | null;
  presentation: string | null;
  description: string | null;
  page_guide: string | null;
  provenance: string | null;
  url: string | null;
  image: string | null;
  photos: unknown[];
  /** Champs annexes du passe-plat non figés au socle. */
  [autre: string]: unknown;
}

/**
 * Proposition du carnet perso (passe-plat de api.poi_propositions, shapes B023).
 * `geom_type` distingue circuit (LINESTRING) et POI (POINT) au rendu ; lon/lat = point représentatif.
 */
export interface CarnetProposition {
  poi_id: number;
  osm_id: string;
  nom: string;
  categorie: string | null;
  tier_defaut: string | null;
  source: string | null;
  niveau_confiance: number | null;
  flag_pepite: boolean;
  geom_type: string | null;
  lon: number | null;
  lat: number | null;
}
