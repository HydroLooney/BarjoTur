// Contrats GIS-MCDA (cf A09, A14 et docs/gis-mcda). Le détail des formules vit côté calc (Worker A) ;
// le socle n'expose que la forme des sorties consommées par le serveur et le front.

/** Facteurs F1..F8, normalisés dans [0,1], orthogonaux (VIF contrôlé). */
export type FacteurId = 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6' | 'F7' | 'F8';

export type Facteurs = Partial<Record<FacteurId, number>>;

/** Les quatre couches séparées de la refonte, plus la faisabilité (F6, non votée). */
export type CoucheMcda = 'qualite' | 'philosophie' | 'envies' | 'votes' | 'faisabilite';

export interface ScorePoi {
  poiId: number;
  facteurs: Facteurs;
  /**
   * Reward du composeur. Anti-cadrage : ne doit pas être exposé pendant le vote
   * (visible en sortie / Coulisses seulement). null tant que non calculé.
   */
  reward: number | null;
}
