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

/** Entrée de l'allocation. `lieux` porte les courbes de consensus (déjà fusionnées entre voyageurs, égalitariste). */
export interface EntreeAllocation {
  lieux: CourbeLieu[];
  couts_trajet: CoutTrajet[];
  cadre: Cadre;
  mode: ModeAllocation;
  /** En mode `manuel` : nuits imposées par lieu (contrainte). */
  nuits_imposees?: Record<number, number>;
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
}
