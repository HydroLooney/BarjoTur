import type { PointGeom } from './geo.js';

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
