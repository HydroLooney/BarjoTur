import { create } from 'zustand';
import type { Tier } from '@barjotur/shared';

export type OngletExplorer = 'carte' | 'liste' | 'recos' | 'mes-lieux';

export interface FiltresExplorer {
  categorie: string | null;
  tier: Tier | null;
  votableSeul: boolean;
  recherche: string;
}

interface EtatExplorer {
  onglet: OngletExplorer;
  poiSelectionne: number | null;
  filtres: FiltresExplorer;
  zoom: number;
  centre: [number, number]; // [lon, lat]
  setOnglet: (o: OngletExplorer) => void;
  setPoiSelectionne: (id: number | null) => void;
  setFiltres: (f: Partial<FiltresExplorer>) => void;
  setZoom: (z: number) => void;
  setCentre: (c: [number, number]) => void;
}

const FILTRES_DEFAUT: FiltresExplorer = {
  categorie: null,
  tier: null,
  votableSeul: false,
  recherche: '',
};

const CENTRE_NORVEGE: [number, number] = [10, 63];

// Etat local Explorer : onglet actif, POI selectionne (partage carte <-> liste <-> fiche),
// filtres (partages carte <-> liste), position carte (persistee aux aller-retours d'onglet).
// Etat UI seulement. Cache serveur dans react-query (useAllPois, useMesVotes...).
export const useExplorer = create<EtatExplorer>((set) => ({
  onglet: 'liste',
  poiSelectionne: null,
  filtres: FILTRES_DEFAUT,
  zoom: 4,
  centre: CENTRE_NORVEGE,
  setOnglet: (onglet) => set({ onglet }),
  setPoiSelectionne: (poiSelectionne) => set({ poiSelectionne }),
  setFiltres: (f) => set((s) => ({ filtres: { ...s.filtres, ...f } })),
  setZoom: (zoom) => set({ zoom }),
  setCentre: (centre) => set({ centre }),
}));
