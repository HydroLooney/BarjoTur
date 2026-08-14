import { useQuery } from '@tanstack/react-query';
import type { Voyage } from '@barjotur/shared';
import { api } from '@/lib/api';

// Instance voyage (A19 / M055) : passe-plat de `GET /api/voyage/:voyage_id` (RPC lecture PRÉCIEUSE côté B).
// Flip-ready : gaté `actif` ; hors live le composant lit la fixture. Le transit typé (EtapeTransit) et son
// optimisation vivent côté calcul (gatés corridor) ; le front les câblera au flip.
export function useVoyage(voyageId: number, actif: boolean) {
  return useQuery({
    queryKey: ['voyage', voyageId],
    enabled: actif,
    queryFn: () => api.get<Voyage>(`/voyage/${voyageId}`),
    retry: 0,
  });
}
