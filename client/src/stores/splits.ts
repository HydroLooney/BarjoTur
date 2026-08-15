import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Mémoire des ratios de split PAR ESPACE (SPEC-CONSOLIDEE §A / M136) : quand on repositionne le séparateur d'une
// vue à deux volets (Explorer liste/carte, Notre Voyage, Carte), le ratio choisi est retenu, par espace, entre
// les sessions. État UI pur (persisté localement), aucune donnée serveur. Clé = un identifiant d'espace stable.
interface EtatSplits {
  /** ratio du volet GAUCHE, fraction 0..1, par clé d'espace. */
  ratios: Record<string, number>;
  setRatio: (cle: string, ratio: number) => void;
}

export const useSplits = create<EtatSplits>()(
  persist(
    (set) => ({
      ratios: {},
      setRatio: (cle, ratio) => set((s) => ({ ratios: { ...s.ratios, [cle]: ratio } })),
    }),
    { name: 'barjotur-splits' },
  ),
);
