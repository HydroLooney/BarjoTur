import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Circuit } from '@barjotur/shared';

// Circuit adopté (M108) : le circuit de guide « repris » comme point de départ du composeur, gardé en local
// (persist par appareil). C'est un CANEVAS SOUPLE : on en retire des étapes, on l'abandonne, et au flip il se
// re-route en van/rando (côté A, gaté DSN). On travaille sur une COPIE, jamais sur la fixture d'origine.
interface EtatCircuitAdopte {
  circuit: Circuit | null;
  adopter: (c: Circuit) => void;
  abandonner: () => void;
  retirerEtape: (ordre: number) => void;
}

export const useCircuitAdopte = create<EtatCircuitAdopte>()(
  persist(
    (set) => ({
      circuit: null,
      adopter: (c) => set({ circuit: { ...c, etapes: [...c.etapes] } }),
      abandonner: () => set({ circuit: null }),
      retirerEtape: (ordre) =>
        set((s) =>
          s.circuit
            ? { circuit: { ...s.circuit, etapes: s.circuit.etapes.filter((e) => e.ordre !== ordre) } }
            : s,
        ),
    }),
    { name: 'barjotur-circuit-adopte' },
  ),
);
