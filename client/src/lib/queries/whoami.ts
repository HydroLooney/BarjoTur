import { useQuery } from '@tanstack/react-query';
import type { Whoami } from '@barjotur/shared';
import { api } from '@/lib/api';

/**
 * Bootstrap d'identite depuis le code_lien (non gate PIN, A03).
 * Enabled seulement si le code est connu. staleTime Infinity : l'identite ne change pas en session.
 * Resultat autoritaire serveur (A03) : le store identite.ts se base sur ce retour.
 */
export function useWhoami(code: string | null) {
  return useQuery({
    queryKey: ['whoami', code],
    enabled: !!code,
    queryFn: () => api.get<Whoami>(`/whoami/${encodeURIComponent(code as string)}`),
    staleTime: Infinity,
    retry: 0,
  });
}
