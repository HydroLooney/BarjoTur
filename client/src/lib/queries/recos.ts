import { useQuery } from '@tanstack/react-query';
import type { RecosReponse } from '@barjotur/shared';
import { api } from '@/lib/api';

// Recommandations personnalisées du voyageur ACTIF (M379/M381/M426, B114) : `GET /api/recos/:code` → `RecosReponse`.
// Chaque `Reco` est AUTOPORTANT (cle, nom, lat, lon, sous_zone_id, tier?, rang) → la couche animée les place sans
// dépendre du geojson. Dégrade `[]` avant le flip. Par voyageur (le `:code` = le lien actif). Cache 1 min.
export function useRecos(code: string | null | undefined) {
  return useQuery({
    queryKey: ['recos', code],
    enabled: !!code,
    queryFn: () => api.get<RecosReponse>(`/recos/${encodeURIComponent(code as string)}`),
    staleTime: 60_000,
    retry: 0,
  });
}
