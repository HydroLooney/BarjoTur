import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Onboarding (T042) : mémorise si l'utilisateur a vu le panneau « on démarre ici ». Persisté en local
// (par appareil) : on ne le remontre pas à chaque visite, mais on peut le réafficher depuis les Réglages.
interface EtatOnboarding {
  vu: boolean;
  /** Astuce contextuelle « comment voter » sur Explorer (mini-tour T042), vue une fois puis masquée. */
  astuceVoteVue: boolean;
  marquerVu: () => void;
  masquerAstuceVote: () => void;
  reafficher: () => void;
}

export const useOnboarding = create<EtatOnboarding>()(
  persist(
    (set) => ({
      vu: false,
      astuceVoteVue: false,
      marquerVu: () => set({ vu: true }),
      masquerAstuceVote: () => set({ astuceVoteVue: true }),
      // Revoir les premiers pas ramène aussi les astuces contextuelles.
      reafficher: () => set({ vu: false, astuceVoteVue: false }),
    }),
    { name: 'barjotur-onboarding' },
  ),
);
