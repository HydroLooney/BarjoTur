import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Onboarding (T042) : mémorise si l'utilisateur a vu le panneau « on démarre ici ». Persisté en local
// (par appareil) : on ne le remontre pas à chaque visite, mais on peut le réafficher depuis les Réglages.
interface EtatOnboarding {
  vu: boolean;
  marquerVu: () => void;
  reafficher: () => void;
}

export const useOnboarding = create<EtatOnboarding>()(
  persist(
    (set) => ({
      vu: false,
      marquerVu: () => set({ vu: true }),
      reafficher: () => set({ vu: false }),
    }),
    { name: 'barjotur-onboarding' },
  ),
);
