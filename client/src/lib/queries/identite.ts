import { useQuery } from '@tanstack/react-query';
import type { Whoami } from '@barjotur/shared';
import { api } from '@/lib/api';

// Bootstrap d'identite : resout le code de lien en membre cote serveur (non gate PIN, A03).
// L'identite ne change pas en cours de session -> staleTime infini.
export function useWhoami(code: string | null) {
  return useQuery({
    queryKey: ['whoami', code],
    enabled: !!code,
    staleTime: Infinity,
    queryFn: () => api.get<Whoami>(`/whoami/${encodeURIComponent(code as string)}`),
  });
}
