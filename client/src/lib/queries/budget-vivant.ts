import { useQuery } from '@tanstack/react-query';
import type { BudgetVivant } from '@barjotur/shared';
import { api } from '@/lib/api';

// Budget vivant (#3) <-> serveur (contrat shared 41903c8 ; endpoint B177 : GET /api/budget-vivant/:code). Confronte 3
// sources (marges expert + itinéraire + réservations réelles) en EUR-only. Branché sur le `code` du voyageur.
// Dégradation DOUCE : tant que le bff n'expose pas la route (ordre de redeploy), l'appel échoue en silence (retry 0)
// → pas de vue budget vivant, le reste de l'onglet Budget tient ; dès le bff redéployé, la vue se remplit. R1 : les
// champs non produits (suivi vécu, caps) arrivent vides/null, le rendu les masque ou les dit « à venir ».

export function useBudgetVivant(code: string | null) {
  return useQuery({
    queryKey: ['budget-vivant', code],
    enabled: !!code,
    queryFn: () => api.get<BudgetVivant>(`/budget-vivant/${code}`),
    staleTime: 60_000,
    retry: 0,
  });
}
