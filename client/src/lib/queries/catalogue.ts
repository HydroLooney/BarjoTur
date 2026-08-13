import { useQuery } from '@tanstack/react-query';
import type { CataloguePoi } from '@barjotur/shared';
import { api } from '@/lib/api';

// Catalogue des POI votables (api.catalogue, ~488 POI riches : osm_id, categorie, tier_defaut, scores...).
// Source de la liste Explorer et des tuiles de vote (B014). Cache 2 min (bouge peu en session).
export function useCatalogue() {
  return useQuery({
    queryKey: ['catalogue'],
    queryFn: () => api.get<CataloguePoi[]>('/catalogue'),
    staleTime: 120_000,
    retry: 0,
  });
}
