import { useQuery } from '@tanstack/react-query';
import type { Poi } from '@barjotur/shared';
import type { Geometry } from 'geojson';
import { api } from '@/lib/api';

// Hooks de lecture des POI. Frontiere reseau unique : tout passe par api.ts + react-query.
// Aucun composant ne fait de fetch direct. Enabled seulement si les parametres sont fournis.
// Pas de crash si le BFF n'est pas encore branche : ErreurApi capturee par react-query.

/** Tous les POI (votables + non-votables). Cache 2 min (les donnees bougent peu en session). */
export function useAllPois() {
  return useQuery({
    queryKey: ['pois', 'all'],
    queryFn: () => api.get<Poi[]>('/pois'),
    staleTime: 120_000,
    retry: 0,
  });
}

/** Detail d'un POI par son id numerique (poi.poi.poi_id). */
export function usePoiDetail(id: number | null) {
  return useQuery({
    queryKey: ['pois', 'detail', id],
    enabled: id !== null,
    queryFn: () => api.get<Poi>(`/pois/${id as number}`),
    retry: 0,
  });
}

/** Lieux ajoutes par le voyageur dans son carnet perso (provenance 'voyageur'). */
export function useCarnetLieux(code: string | null) {
  return useQuery({
    queryKey: ['pois', 'carnet', code],
    enabled: !!code,
    queryFn: () => api.get<Poi[]>(`/pois/carnet/${encodeURIComponent(code as string)}`),
    retry: 0,
  });
}

/**
 * Geometrie d'un circuit rando (trace pour la mini-carte de vote, A13).
 * Retourne null si le POI n'est pas une rando ou si le BFF n'expose pas encore la route.
 * retry: 0 = pas de tentative supplementaire si l'endpoint est absent.
 */
export function useRandoGeom(poiId: number | null) {
  return useQuery({
    queryKey: ['pois', 'rando-geom', poiId],
    enabled: poiId !== null,
    queryFn: () => api.get<Geometry | null>(`/pois/${poiId as number}/geom-rando`),
    retry: 0,
  });
}
