import { useQuery } from '@tanstack/react-query';
import type { FeatureCollection } from 'geojson';

// Chargeur de GeoJSON STATIQUE servi depuis public/data/ (découpage, bases, POI de l'échantillon web). Ce ne
// sont pas des endpoints du BFF (api.ts) mais des assets versionnés : on les passe quand même par react-query
// pour bénéficier du cache/dédup et rester cohérent avec la frontière réseau (C11). Au flip (données live), M
// remplacera ces fichiers par les vues `v_web_*` sans changer l'appelant.
export function useGeojsonPublic(url: string, actif = true) {
  return useQuery({
    queryKey: ['geojson-public', url],
    queryFn: async (): Promise<FeatureCollection> => {
      const rep = await fetch(url);
      if (!rep.ok) throw new Error(`GeoJSON indisponible : ${url} (${rep.status})`);
      const brut = (await rep.json()) as { type?: string; data?: FeatureCollection };
      // Robuste static ↔ endpoint BFF : le static est un FeatureCollection nu ; le BFF de B (B119) l'enveloppe dans
      // `{ ok, data: FeatureCollection }`. On dé-emballe `.data` si présent, sinon on prend tel quel.
      return (brut.type === 'FeatureCollection' ? brut : brut.data) as FeatureCollection;
    },
    staleTime: Infinity, // asset statique : ne rebouge pas en session
    retry: 0,
    enabled: actif,
  });
}
