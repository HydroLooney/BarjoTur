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
 * Une photo d'un POI (manifeste A140 / vue v_web_poi_photos au dump final). L'image est un MÉDIA servi en fichier
 * (`chemin`, sous poi/…/photos/) ; ici on ne porte que les MÉTADONNÉES d'affichage (ordre, crédit, licence). R1 :
 * `verifie=false` = licence à confirmer (le front peut le signaler).
 */
export interface PhotoPoi {
  fichier: string;
  /** Chemin du média à servir (ex. poi/sorlandet/.../photos/xxx.jpg). Le point de service (statique/CDN/DB2) est calé au Go Live. */
  chemin: string;
  ordre: number;
  credit: string | null;
  licence: string | null;
  libre: boolean;
  verifie: boolean;
  sha256?: string;
  source_url?: string | null;
}

/**
 * Détail d'un POI pour la fiche (passe-plat de api.poi_detail, aligné sur poi.poi). Noyau typé + index signature pour
 * tolérer les champs annexes sans les figer. `cle` = osm_id si valide, sinon `poi:<poi_id>` (3 POI osm-less, A140).
 */
export interface PoiDetail {
  poi_id: number;
  osm_id: string | null;
  cle: string;
  nom: string;
  categorie: string | null;
  sous_categorie: string | null;
  presentation: string | null;
  description: string | null;
  acces_van: string | null;
  fenetre_calme: string | null;
  temps_visite: number | null;
  tier_defaut: string | null;
  payant: boolean | null;
  tarif: string | null;
  reservation: string | null;
  saison: string | null;
  parking: string | null;
  tags: string[] | null;
  url: string | null;
  liens_officiels: string[] | null;
  page_guide: number | null;
  region_id: string | null;
  zone_id: string | null;
  votable: boolean | null;
  [autre: string]: unknown;
}

/**
 * Fiche POI complète servie par GET /api/poi/:cle (M405/A140), chargée en lazy par C à l'ouverture de la fiche.
 * `detail` = null si POI inconnu / RPC pas encore posée (dégradation) ; `photos` = [] si aucune photo vérifiée.
 */
export interface PoiFiche {
  detail: PoiDetail | null;
  photos: PhotoPoi[];
}

/**
 * Une recommandation personnalisée d'un voyageur (haut de son budget TSAB, B114/M379) — un POI mis en avant pour LUI.
 * AUTOPORTANTE pour la couche carte animée (symbole pulsé à TOUS les zooms, hors clustering) et le clic → fitBounds sur
 * la SOUS-ZONE centrée (M381) → ouverture de la fiche : porte donc coordonnées + `sous_zone_id` + `cle` (pas de
 * dépendance au geojson chargé au zoom courant).
 */
export interface Reco {
  /** Clé du POI = osm_id (ou `poi:<id>` osm-less) → adapteur fiche / `usePoiFiche`. */
  cle: string;
  nom: string;
  lat: number;
  lon: number;
  /**
   * Clé (SLUG) de la sous-zone d'appartenance (ex. `'oslo__2'`, `'telemark-rjukan__4'`) — pour le `fitBounds` sur la
   * sous-zone centrée (M381, lookup `v_web_decoupage.id`, en String) ; `null` = fallback centre sur le point.
   */
  sous_zone_id: string | null;
  /** Tier calculé du POI (T-C), pour l'emphase éventuelle. */
  tier?: string | null;
  /** Rang de recommandation (1 = top) pour l'ordre / l'accent. */
  rang: number;
}

/** GET /api/recos/:code (B114) → recos personnalisées du voyageur (top-N par sa valeur/appétit). Dégrade `[]` avant flip. */
export interface RecosReponse {
  recos: Reco[];
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
