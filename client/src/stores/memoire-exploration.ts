import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Mémoire d'exploration (A11) : quels POI j'ai déjà OUVERTS (« déjà vu »). CLIENT-LOCAL MVP (persisté),
// sync serveur plus tard (B-17). L'état « voté » vient déjà de mes votes (react-query) ; ici on ne garde
// que le « exploré » (fiche ouverte au moins une fois), pour distinguer le non-découvert du déjà-vu.
interface EtatMemoire {
  explores: string[];
  marquerExplore: (osmId: string) => void;
  /** Hydratation serveur (C-18 sync) : fusionne les marques du serveur avec le local (union non destructive). */
  fusionnerServeur: (osmIds: string[]) => void;
  oublierTout: () => void;
}

export const useMemoireExploration = create<EtatMemoire>()(
  persist(
    (set) => ({
      explores: [],
      marquerExplore: (osmId) =>
        set((s) => (s.explores.includes(osmId) ? {} : { explores: [...s.explores, osmId] })),
      fusionnerServeur: (osmIds) =>
        set((s) => ({ explores: [...new Set([...s.explores, ...osmIds])] })),
      oublierTout: () => set({ explores: [] }),
    }),
    { name: 'barjotur-exploration' },
  ),
);
