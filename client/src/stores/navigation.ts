import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Mémoire du dernier sous-onglet visité PAR ESPACE (M506/M543, « état conservé »). Quand on revient sur un espace
// (par la barre du bas ou l'index), on rouvre LÀ où on l'a laissé, pas systématiquement au 1er onglet. Persisté pour
// survivre au rechargement. Purement local (préférence de navigation, aucune donnée métier).

interface EtatNavigation {
  dernier: Record<string, string>;
  setDernier: (espace: string, cle: string) => void;
}

export const useNavigation = create<EtatNavigation>()(
  persist(
    (set) => ({
      dernier: {},
      setDernier: (espace, cle) => set((s) => ({ dernier: { ...s.dernier, [espace]: cle } })),
    }),
    { name: 'barjotur-nav' },
  ),
);
