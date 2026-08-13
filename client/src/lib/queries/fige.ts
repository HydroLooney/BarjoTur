import { useQuery } from '@tanstack/react-query';
import type { FigeDetail, ScenarioDefaut } from '@barjotur/shared';
import { api } from '@/lib/api';

// Lecture d'un itineraire fige (api.fige_lire cote DB2 : geometrie continue + agenda detaille).
// Contrat M011 : FigeDetail (itineraire + geom MultiLineString + etapes + waypoints).

/** Scenario par defaut (api.scenario_defaut) : 'retenu' sinon 'consensus' sinon 'aucun'. */
export function useScenarioDefaut() {
  return useQuery({
    queryKey: ['fige', 'scenario-defaut'],
    // Route reelle cote BFF : GET /api/scenario-defaut (server/src/routes/fige.ts, monte sous /api), pas /api/fige/...
    queryFn: () => api.get<ScenarioDefaut>('/scenario-defaut'),
    staleTime: 30_000,
    retry: 0,
  });
}

/**
 * Itineraire fige riche (api.fige_lire) par fige_id.
 * Enabled seulement si un id est fourni (non-bloquant tant que B n'expose pas la route).
 */
export function useFigeDetail(figeId: number | null) {
  return useQuery({
    queryKey: ['fige', figeId],
    enabled: figeId !== null,
    queryFn: () => api.get<FigeDetail>(`/fige/${figeId as number}`),
    retry: 0,
  });
}

/** Alias : meme hook que useFigeDetail (compatibilite avec la v3 precedente). */
export const useFige = useFigeDetail;
