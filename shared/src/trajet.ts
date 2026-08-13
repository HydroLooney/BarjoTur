import type { LineStringGeom } from './geo.js';

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
  /** fige.geom : géométrie continue de l'itinéraire retenu. */
  geom: LineStringGeom;
  agenda: EtapeAgenda[];
}
