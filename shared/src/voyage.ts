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
 * Nature d'une opération logistique sur un transit aller/retour (A19 §8, source `canon/points_fixes.json`).
 * Les étapes obligatoires ne sont pas que du roulage : enlèvement, chargement, embarquement (2 h avant),
 * traversée, halte de nuit, arrivée, puis au retour nettoyage/déchargement/restitution. Chacune porte un
 * budget temps précis et une marge de sécurité. Le composeur les traite comme des jalons obligatoires.
 */
export type TypeOperationTransit =
  | 'enlevement_van'
  | 'chargement'
  | 'roulage'
  | 'halte_nuit'
  | 'embarquement_ferry'
  | 'traversee_ferry'
  | 'arrivee'
  | 'nettoyage_van'
  | 'dechargement'
  | 'restitution_van';

/**
 * Un arrêt candidat du faisceau d'une étape de transit (A19 §2). Les arrêts sont des candidats, pas des POI
 * obligatoires ; l'optimisation transit en choisit. `epingle` = imposé (par l'utilisateur OU une réservation).
 * Un point fixe non négociable (enlèvement/ferry/restitution) est un arrêt `epingle`+`reserve` porteur d'une
 * `operation` typée, d'une `marge_securite_min` (ex. 120 = « être à l'embarquement 2 h avant ») et d'une
 * `checklist` de sécurité (récupérer, charger, décharger, nettoyer, état des lieux).
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
  /** Opération logistique portée par cet arrêt (null = simple candidat de halte, pas d'opération). */
  operation?: TypeOperationTransit | null;
  /** Horodatage contraint de l'opération (ISO), ex. enlèvement van 2027-08-03T09:00, ferry 16:15. Null si libre. */
  datetime?: string | null;
  /** Marge de sécurité en minutes à réserver AVANT l'opération (ex. 120 pour l'embarquement ferry). */
  marge_securite_min?: number | null;
  /** Checklist de sécurité de l'opération (prise en main, état des lieux, chargement, nettoyage, restitution). */
  checklist?: string[];
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
  /** Budget de route (minutes) de cette étape obligatoire ; null si étape libre. Aligné sur `voyage.ancre.budget_roulage_min` (ancre ferry/transit). Contrainte dure du composeur (garde `FenetreFerry`). */
  budget_min?: number | null;
  /** Le faisceau d'arrêts candidats. */
  faisceau: ArretTransit[];
}
