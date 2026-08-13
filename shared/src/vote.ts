// Contrat de vote, aligné sur decision.vote_lieu / vote_variante / vote_circuit (+ *_hist).
// Voter n'est jamais gaté PIN (cf A03). Le sens d'un vote ne change pas sans validation (casse le consensus).

export type CibleVote = 'lieu' | 'variante' | 'circuit';

export interface Vote {
  /** membre.membre.id de l'auteur. */
  voyageurId: number;
  cible: CibleVote;
  /** poi_id, variante_id ou circuit_id selon la cible. */
  cibleId: number;
  /**
   * Valeur du vote. Échelle laissée ouverte ici (les couches A/B fixent la grammaire exacte) ;
   * le socle ne verrouille que la forme, pas les bornes, pour ne pas figer prématurément.
   */
  valeur: number;
}
