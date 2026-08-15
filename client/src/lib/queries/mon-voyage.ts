import { useQuery } from '@tanstack/react-query';
import type { MonVoyageIdeal } from '@barjotur/shared';
import { api } from '@/lib/api';

// Mon voyage idéal (#2) <-> serveur (contrat shared 5106fd2 ; endpoint M554 : GET /api/mon-voyage/:code). L'itinéraire
// composé pour la SEULE signature du voyageur (son idéal) + son écart au voyage commun. Branché sur le `code`.
// Dégradation DOUCE : tant que le bff n'expose pas la route, l'appel échoue en silence (retry 0) → l'espace Mon
// voyage garde ses réglages, sans itinéraire idéal ; dès le bff redéployé, l'idéal + l'écart se remplissent.

export function useMonVoyageIdeal(code: string | null) {
  return useQuery({
    queryKey: ['mon-voyage', code],
    enabled: !!code,
    queryFn: () => api.get<MonVoyageIdeal>(`/mon-voyage/${code}`),
    staleTime: 60_000,
    retry: 0,
  });
}
