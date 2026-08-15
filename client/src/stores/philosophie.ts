import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PhilosophieProfil, CurseurCle, EnvieCle } from '@barjotur/shared';
import { profilDefaut } from '@/lib/philosophie';

// Profil voyageur UNIQUE (M502/M511) — état LOCAL optimiste, miroir de la vérité serveur (DB2). Le questionnaire
// guidé ET les curseurs directs écrivent CE profil ; un push débattu l'envoie au serveur, qui le passe au composeur
// (reward MCDA v3, prouvé B169). Modèle natif [0..1] : aucune conversion. Persisté pour rester lisible hors ligne.
// La version de persistance saute l'ancien modèle 8 axes (clé identique) : au premier chargement, on repart au défaut.

interface EtatPhilo {
  profil: PhilosophieProfil;
  reglerCurseur: (cle: CurseurCle, valeur: number) => void;
  reglerEnvie: (cle: EnvieCle, valeur: number) => void;
  reglerCapNord: (valeur: number) => void;
  remplacer: (profil: PhilosophieProfil) => void;
  reinitialiser: () => void;
}

const borne = (v: number) => Math.min(1, Math.max(0, v));

export const usePhilosophie = create<EtatPhilo>()(
  persist(
    (set) => ({
      profil: profilDefaut(),
      reglerCurseur: (cle, valeur) =>
        set((s) => ({ profil: { ...s.profil, curseurs: { ...s.profil.curseurs, [cle]: borne(valeur) } } })),
      reglerEnvie: (cle, valeur) =>
        set((s) => ({ profil: { ...s.profil, envies: { ...s.profil.envies, [cle]: borne(valeur) } } })),
      reglerCapNord: (valeur) => set((s) => ({ profil: { ...s.profil, cap_nord: borne(valeur) } })),
      remplacer: (profil) => set({ profil }),
      reinitialiser: () => set({ profil: profilDefaut() }),
    }),
    {
      name: 'barjotur-philosophie',
      version: 1,
      // L'ancien modèle 8 axes (version 0) n'est pas migrable vers les 7 curseurs + 4 envies : on repart au défaut.
      migrate: () => ({ profil: profilDefaut() }),
    },
  ),
);
