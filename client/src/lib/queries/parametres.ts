import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

// Registre single-source des parametres (budget.parametre en DB2).
// Lecture en Coulisses (C09 / A08). Pas de crash si le BFF n'est pas branche.

/** Un parametre du registre single-source. */
export interface Parametre {
  /** Cle unique du parametre (ex. 'overhead_roulage_min_pct'). */
  cle: string;
  /** Valeur active. */
  valeur: number | string | boolean;
  /** Valeur recommandee par le moteur, ou null si absente. */
  valeur_recommandee: number | string | boolean | null;
  /** Source de la valeur (ex. 'calcul', 'manuel', 'defaut'). */
  source: string;
  /** Justification en clair de la valeur choisie. */
  justification: string;
  /** Domaine de regroupement (ex. 'Budget', 'Temps', 'GIS-MCDA'). */
  domaine: string;
}

export function useParametres() {
  return useQuery({
    queryKey: ['parametres'],
    queryFn: () => api.get<Parametre[]>('/parametres'),
    staleTime: 60_000,
    retry: 0,
  });
}
