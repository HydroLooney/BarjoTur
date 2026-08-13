import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

// Etat agrege du voyage : avancement vote, cran actuel, etat budget, reservations.
// Sert le fil conducteur du parcours (C19 / A15). Si le BFF n'est pas branche, isError = true
// et l'accueil affiche un message neutre (pas de crash).

/** Etat agrege du voyage tel que retourne par le BFF. */
export interface EtatVoyage {
  /** Avancement du vote, de 0 a 100. */
  vote_pct: number;
  /** Cran actuel du pipeline (idee/explo/vote/composition/logistique/voyage). */
  cran_actuel: string;
  /** Precision croissante du budget au fil du voyage. */
  budget_etat: 'inconnu' | 'pre-budget' | 'estime' | 'fiabilise';
  /** Nombre de reservations posees. */
  reservations_n: number;
  /** Texte de la prochaine action suggeree, ou null si le voyage est complet. */
  prochaine_action: string | null;
}

export function useEtatVoyage() {
  return useQuery({
    queryKey: ['etat-voyage'],
    queryFn: () => api.get<EtatVoyage>('/etat-voyage'),
    staleTime: 30_000,
    retry: 0,
  });
}
