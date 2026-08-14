// Allocation du séjour (A25) : l'entrée/sortie du moteur OR-Tools (sidecar, B) qui répartit le cadre fixe entre les
// lieux. Contrat partagé entre le producteur de reward (A, via B), le sidecar (B) et l'affichage de l'arbitrage (C).
// Amorcé sur synthétique (B053) ; le reward et la matrice réels viennent d'A au flip.

/**
 * Courbe de valeur d'un lieu par nuit passée : `marginaux[k]` = valeur de la (k+1)e nuit. DÉCROISSANTE (rendement
 * décroissant : la 1re nuit capte l'essentiel). C'est la matière fournie par A (reward + densité de valeur).
 */
export interface CourbeLieu {
  lieu_id: number;
  marginaux: number[];
  min_nuits: number;
  max_nuits: number;
}

/** Cadre fixe du voyage : total de nuits et nœuds d'entrée/sortie figés (ferry). */
export interface Cadre {
  total_nuits: number;
  depart: number;
  arrivee: number;
}

/** Coût de trajet entre deux lieux (temps ou temps+€ agrégé, selon la préférence). */
export interface CoutTrajet {
  de: number;
  vers: number;
  cout: number;
}

/** Mode de composition (A25) : nuits fixées à la main, proposées, ou allouées librement. */
export type ModeAllocation = 'manuel' | 'assiste' | 'full_auto';

/**
 * Courbes de valeur PAR VOYAGEUR pour un lieu (A25 leximin). `par_voyageur[voyageur_id]` = la courbe marginale
 * décroissante de CE voyageur pour CE lieu (même sémantique que `CourbeLieu.marginaux`, un voyageur servi 0 nuit
 * compte dans le min). Fournies par le composeur, qui les a déjà pour l'agrégation égalitariste.
 */
export interface CourbesVoyageurLieu {
  lieu_id: number;
  par_voyageur: Record<number, number[]>;
}

/** Entrée de l'allocation. `lieux` porte les courbes de consensus (déjà fusionnées entre voyageurs, égalitariste). */
export interface EntreeAllocation {
  lieux: CourbeLieu[];
  couts_trajet: CoutTrajet[];
  cadre: Cadre;
  mode: ModeAllocation;
  /** En mode `manuel` : nuits imposées par lieu (contrainte). */
  nuits_imposees?: Record<number, number>;
  /**
   * Optionnel (A25 max-min leximin, B084) : courbes de valeur PAR VOYAGEUR par lieu, alignées sur `lieux` (mêmes
   * `lieu_id`, mêmes bornes min/max). Présentes → le sidecar peut viser le max-min ÉGALITARISTE par voyageur
   * (`max m, m ≤ V_t = Σ marginaux_t·x ∀t`) plutôt que l'utilitaire sur consensus, validé par l'oracle `leximin_ref`.
   * Absentes → allocation utilitaire sur `lieux` (statu quo). Additif, non-cassant.
   */
  courbes_par_voyageur?: CourbesVoyageurLieu[];
}

/** Un lieu GARDÉ : combien de nuits, et le marginal de la nuit suivante (ce qu'un jour de plus vaudrait) / dernière. */
export interface LieuGarde {
  lieu: number;
  nuits: number;
  marginal_suivant: number;
  marginal_dernier: number;
}

/** Un lieu LAISSÉ : le marginal de sa 1re nuit (ce qu'on renonce à capter). */
export interface LieuLaisse {
  lieu: number;
  marginal_premier: number;
}

/**
 * Résultat de l'allocation : la sélection, les nuits par lieu, l'ordre, la valeur captée, et surtout l'ARBITRAGE
 * LISIBLE (`gardes`/`laisses`) que C affiche (« gardé Oslo 2n ; laissé Y ; un jour de plus ici vaudrait X »).
 */
export interface ResultatAllocation {
  selection: number[];
  nuits: Record<number, number>;
  ordre: number[];
  valeur_captee: number;
  cout_trajet: number;
  gardes: LieuGarde[];
  laisses: LieuLaisse[];
  /** Faux si aucun tour complet n'existe (paire de trajet manquante = coût infini). Absent = supposé faisable. */
  faisable?: boolean;
  /** Raison d'une infaisabilité (ex. « aucune route entre X et Y »), pour l'expliquer à l'écran. */
  raison?: string;
}
