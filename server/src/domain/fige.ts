// Lecture d'un itinéraire figé (api.fige_lire), pour la carte animée et la fiche d'itinéraire (C16, T008).
// La géométrie continue est un MultiLineString (SRID 4326) : traversées ferry en tronçons distincts.
//
// La géométrie réutilise `MultiLineStringGeom` du socle. En revanche la FORME d'ensemble ci-dessous
// (itineraire + geom + etapes + waypoints) épouse le retour RÉEL de api.fige_lire, plus riche que le
// `FigeItineraire` minimal du socle ({profil, geom, agenda}). Demande postée au Maître pour poser un
// contrat fige riche dans @barjotur/shared/trajet.ts ; d'ici là, cette forme reste locale au BFF.

import type { MultiLineStringGeom } from '@barjotur/shared';

/** Métadonnées de l'itinéraire figé (fige.itineraire, moins la colonne geom sortie à part). */
export interface ItineraireFige {
  fige_id: number;
  code: string | null;
  label: string | null;
  fige_at: string | null;
  km: number | null;
  temps_min: number | null;
  denivele_pos_m: number | null;
  nuits: number | null;
  ferry_interieur_eur: number | null;
  famille: string | null;
  archetype_key: string | null;
  est_archetype: boolean;
  fiche: unknown;
  retenu: boolean;
  calcule_db1: boolean;
  est_consensus: boolean;
  membre_id: number | null;
}

/** Une étape (jour) de l'agenda figé (fige.etape). */
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
  repli: unknown;
  note: string | null;
  date_jour: string | null;
  base_id: number | null;
  lever: string | null;
  coucher: string | null;
  circuit: unknown;
  resume_jour: unknown;
}

/** Retour complet de api.fige_lire(p_fige_id). geom continue = source unique de la carte animée. */
export interface FigeLu {
  itineraire: ItineraireFige;
  geom: MultiLineStringGeom;
  etapes: EtapeFige[];
  waypoints: unknown[];
}
