import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// « Mode expert » (M390/M343) : un INTERRUPTEUR d'affichage opt-in, OFF par defaut, PAS une capacite ni un role.
// Il surface l'affordance « Reglages de cet ecran » sur les ecrans qui portent des parametres experts. Il ne
// donne AUCUN droit : l'overlay ne montre jamais un reglage que l'utilisateur ne peut deja editer (gating par
// capacite, autorite serveur). Un voyageur ordinaire, meme mode expert allume, ne voit rien a regler. Persiste
// pour ne pas re-cocher a chaque session.
interface EtatExpert {
  modeExpert: boolean;
  basculerModeExpert: () => void;
  setModeExpert: (v: boolean) => void;
}

export const useExpert = create<EtatExpert>()(
  persist(
    (set) => ({
      modeExpert: false,
      basculerModeExpert: () => set((s) => ({ modeExpert: !s.modeExpert })),
      setModeExpert: (modeExpert) => set({ modeExpert }),
    }),
    { name: 'barjotur-mode-expert' },
  ),
);
