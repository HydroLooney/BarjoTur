import type { LineStringGeom, MultiLineStringGeom } from './geo.js';

// Contrat de lecture d'un itinéraire figé (cf api.fige_lire en DB2, brique carte animée `fige.geom`).
// La géométrie est CONTINUE (pas des segments recollés), l'agenda l'accompagne.

/**
 * Profil d'itinéraire : archétype, consensus, ou membre. La grammaire précise des identifiants
 * de profil est fixée côté données (Worker A/B) ; le socle n'en garde que la forme.
 */
export type Profil = string;

export interface EtapeAgenda {
  ordre: number;
  /** POI de l'étape, ou null pour une étape de simple transit. */
  poiId: number | null;
  /** Jour du voyage (1..N), ou null si non encore calé. */
  jour: number | null;
}

export interface FigeItineraire {
  profil: Profil;
  /**
   * fige.geom : géométrie de l'itinéraire retenu. Continue par défaut (LineString) ; MultiLineString
   * admis pour les tracés à tronçons (traversées, discontinuités de rendu). Cf brique carte animée (C, T012).
   */
  geom: LineStringGeom | MultiLineStringGeom;
  agenda: EtapeAgenda[];
}

// ---------------------------------------------------------------------------------------------------
// Contrat fige RICHE, aligné sur api.fige_lire(p_fige_id) → jsonb { itineraire, geom, etapes, waypoints }
// (colonnes relevées par B, B007). Clés = payload jsonb réel (snake_case), c'est un passe-plat.
// ---------------------------------------------------------------------------------------------------

/** Métadonnées d'un itinéraire figé (fige.itineraire, hors geom). */
export interface ItineraireFige {
  fige_id: number;
  code: string | null;
  label: string | null;
  /** timestamptz ISO. */
  fige_at: string | null;
  km: number | null;
  temps_min: number | null;
  denivele_pos_m: number | null;
  nuits: number | null;
  ferry_interieur_eur: number | null;
  famille: string | null;
  archetype_key: string | null;
  est_archetype: boolean;
  /** jsonb libre (fiche descriptive). */
  fiche: unknown;
  retenu: boolean;
  calcule_db1: boolean;
  est_consensus: boolean;
  membre_id: number | null;
}

/** Un lieu visité dans la journée, avec le temps qu'on y passe (Atlas, page du jour). */
export interface LieuJour {
  nom: string;
  temps_min: number;
}

/**
 * Résumé riche d'une journée, tel que l'Atlas et la fiche jour l'affichent (une page par jour) : camp de base, lieux
 * visités avec leur temps sur place, kilomètres, traversées ferry, budget du jour. Produit par B (compo + budget-jour)
 * dans `EtapeFige.resume_jour` ; consommé par C. Tout est optionnel : on n'affiche que ce qui est présent (R1).
 */
export interface ResumeJour {
  camp_base?: string;
  km?: number;
  ferry_min?: number;
  ferry_eur?: number;
  traversees?: number;
  budget_eur?: number;
  lieux?: LieuJour[];
}

/** Étape jour d'un itinéraire figé (fige.etape, ordonné par jour). */
export interface EtapeFige {
  fige_id: number;
  jour: number;
  aire_lat: number | null;
  aire_lon: number | null;
  stop_id: number | null;
  nuitee_type: string | null;
  poi_osm_ids: string[] | null;
  tier_jour: string | null;
  roulage_min: number | null;
  meteo_dependant: boolean | null;
  /** jsonb (plan de repli). */
  repli: unknown;
  note: string | null;
  /** date ISO. */
  date_jour: string | null;
  base_id: number | null;
  /** time (HH:MM:SS). */
  lever: string | null;
  coucher: string | null;
  /** jsonb (circuit rando du jour). */
  circuit: unknown;
  /** Résumé riche du jour (Atlas / fiche jour), produit par B. Null tant qu'il n'est pas calculé. */
  resume_jour: ResumeJour | null;
}

/** Waypoint imposé d'un itinéraire figé (fige.waypoint_impose, ordonné par `ordre`). Colonnes relevées par B (B009). */
export interface WaypointImpose {
  fige_id: number;
  kind: string | null;
  ref_id: string | null;
  node: number | null;
  ordre: number;
}

/** Retour riche de api.fige_lire : géométrie continue MultiLineString + agenda détaillé. */
export interface FigeDetail {
  itineraire: ItineraireFige;
  geom: MultiLineStringGeom;
  etapes: EtapeFige[];
  /** fige.waypoint_impose, ordonné par `ordre` (souvent vide). */
  waypoints: WaypointImpose[];
}

/** Retour de api.scenario_defaut : le profil par défaut à afficher (défaut courant = consensus, fige_id 141). */
export interface ScenarioDefaut {
  fige_id: number | null;
  source: 'retenu' | 'consensus' | 'aucun';
  /** null pour le consensus (label "consensus"), sinon le code du profil (B009). */
  code?: string | null;
  archetype_key?: string | null;
  label?: string;
  calcule_db1?: boolean;
  km?: number;
  nuits?: number;
}
