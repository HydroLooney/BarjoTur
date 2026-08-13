import { useQuery } from '@tanstack/react-query';
import type { FeatureCollection } from 'geojson';
import { api } from '@/lib/api';

export interface BBox {
  minlon: number;
  minlat: number;
  maxlon: number;
  maxlat: number;
}

/** Arrondit les bornes pour stabiliser la clé de cache (évite un refetch à chaque micro-déplacement). */
function arrondirBBox(b: BBox): BBox {
  const r = (n: number) => Math.round(n * 100) / 100;
  return { minlon: r(b.minlon), minlat: r(b.minlat), maxlon: r(b.maxlon), maxlat: r(b.maxlat) };
}

// POI dans l'emprise carto visible (api.poi/bbox → FeatureCollection : poi.poi + poi.poi_app,
// properties osm_id/nom/categorie/tier_defaut/votable/source). Source de la carte Explorer (B014).
export function useBboxPois(bbox: BBox | null) {
  const key = bbox ? arrondirBBox(bbox) : null;
  return useQuery({
    queryKey: ['poi-bbox', key],
    enabled: bbox !== null,
    queryFn: () => {
      const b = key as BBox;
      const q = `minlon=${b.minlon}&minlat=${b.minlat}&maxlon=${b.maxlon}&maxlat=${b.maxlat}`;
      return api.get<FeatureCollection>(`/poi/bbox?${q}`);
    },
    staleTime: 60_000,
    retry: 0,
  });
}
