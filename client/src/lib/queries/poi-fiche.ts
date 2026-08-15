import { useQuery } from '@tanstack/react-query';
import type { PoiFiche } from '@barjotur/shared';
import { api } from '@/lib/api';

// Détail + photos d'un POI (B125, M405/A140), chargés en LAZY à l'ouverture de la fiche : `GET /api/poi/:cle` →
// `{ detail, photos }`. `:cle` = osm_id ou `poi:<id>`. `detail` réel (poi.poi) ; `photos` = manifeste trié par ordre
// (crédit/licence). Les binaires photos sont servis au Go Live → d'ici là l'`onError` du hero retombe sur le fallback
// charté (POI-sans-photo). Flip-ready : `v_web_poi_photos` prend le relais au dump final, même forme, zéro re-câblage.
export function usePoiFiche(cle: string | null | undefined) {
  return useQuery({
    queryKey: ['poi-fiche', cle],
    enabled: !!cle,
    queryFn: () => api.get<PoiFiche>(`/poi/${encodeURIComponent(cle as string)}`),
    staleTime: 120_000,
    retry: 0,
  });
}
