// Contrat de l'INSTANCE VOYAGE (A19 §9) : origine, destination, étapes typées expérience/transit.
// Norvège 2027 n'est qu'une instance ; l'app est un composeur de voyages rejouable (A18 §7.3, multi-voyage-ready).
// STRUCTURE ; le routage réel du corridor et l'optimisation transit sont côté calcul/sidecar (gatés recompute).

/** Un point géocodé du voyage (origine, destination, arrêt). */
export interface PointVoyage {
  /** Adresse lisible, ex. « 12 Coteau de la Pinède, 67590 Schweighouse-sur-Moder ». */
  label: string;
  lat: number;
  lon: number;
}

/** Nature d'une étape : expérience (orienteering, on maximise le beau) ou transit (repositionnement, on minimise). */
export type NatureEtape = 'experience' | 'transit';

/** L'instance voyage, rejouable. `point_depart`/`point_arrivee` sont posés au démarrage (cran cadrage, A18). */
export interface Voyage {
  voyage_id: number;
  titre: string;
  /** Origine du voyage. Ici « 12 Coteau de la Pinède, 67590 Schweighouse-sur-Moder » (domicile). */
  point_depart: PointVoyage;
  /** Destination finale. = point_depart si l'A/R est bouclé ; peut différer (aller simple, fin ailleurs). */
  point_arrivee: PointVoyage;
}

/**
 * Un arrêt candidat du faisceau d'une étape de transit (A19 §2). Les arrêts sont des candidats, pas des POI
 * obligatoires ; l'optimisation transit en choisit. `epingle` = imposé (par l'utilisateur OU une réservation).
 */
export interface ArretTransit {
  id: string;
  label: string;
  lat: number;
  lon: number;
  /** Imposé : l'optimisation doit le retenir (choix utilisateur ou réservation confirmée). */
  epingle: boolean;
  /** Épinglé parce que réservé (jalon imposé par une réservation, A18/A19 §8.1). */
  reserve: boolean;
  /** Nuit en autonomie (aire/bivouac, défaut privilégié A19 §8.4) vs hébergement payant. */
  autonomie: boolean;
}

/**
 * Une étape de transit : relie deux points, sous un jalon de date éventuel (ferry), avec un faisceau de candidats.
 * L'optimisation transit (minimiser temps/coût, défaut nuits en autonomie) vit côté sidecar (gatée corridor routable).
 */
export interface EtapeTransit {
  id: string;
  ordre: number;
  depuis: PointVoyage;
  vers: PointVoyage;
  /** Date fixe qui contraint l'optimisation (ex. départ ferry). Null si libre. */
  jalon_date: string | null;
  /** Le faisceau d'arrêts candidats. */
  faisceau: ArretTransit[];
}
