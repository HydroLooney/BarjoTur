import { useMutation, useQuery } from '@tanstack/react-query';
import type { ComposeInput, ComposeReponse } from '@barjotur/shared';
import { api } from '@/lib/api';

// Composeur (C06/C11) : passe-plat du sidecar OR-Tools. La galerie d'archétypes n'est pas encore typée
// dans shared (GET /api/archetypes) : typage souple ici, à remonter quand B fige les colonnes.
export interface Archetype {
  archetype_key?: string;
  key?: string;
  label?: string;
  nom?: string;
  description?: string;
  nuits?: number;
  km?: number;
  [autre: string]: unknown;
}

/** Galerie des archétypes (7), pour comparer les signatures de voyage. */
export function useArchetypes() {
  return useQuery({
    queryKey: ['archetypes'],
    queryFn: () => api.get<Archetype[]>('/archetypes'),
    staleTime: 300_000,
    retry: 0,
  });
}

/** Lancer une composition (OR-Tools). Écriture idempotente ; persister=true fige le résultat. */
export function useComposer() {
  return useMutation({
    mutationFn: (input: ComposeInput) => api.post<ComposeReponse>('/composer', input, { idempotent: true }),
  });
}
