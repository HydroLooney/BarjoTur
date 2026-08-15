import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { philoDefaut } from '@/lib/philosophie';

// Profil de philosophie « Ta façon de voyager » (AUDIT-FRONT P0 #1). État LOCAL persistant (chaque voyageur règle
// le sien) ; au flip, `remplacer` hydrate depuis le serveur et un push enverra le profil au composeur (contrat B :
// persister le profil philo par voyageur + le passer en pondération du reward MCDA v3). Valeurs 0-100 par axe.
interface EtatPhilo {
  valeurs: Record<string, number>;
  regler: (cle: string, valeur: number) => void;
  remplacer: (valeurs: Record<string, number>) => void;
  reinitialiser: () => void;
}

export const usePhilosophie = create<EtatPhilo>()(
  persist(
    (set) => ({
      valeurs: philoDefaut(),
      regler: (cle, valeur) => set((s) => ({ valeurs: { ...s.valeurs, [cle]: valeur } })),
      remplacer: (valeurs) => set({ valeurs: { ...philoDefaut(), ...valeurs } }),
      reinitialiser: () => set({ valeurs: philoDefaut() }),
    }),
    { name: 'barjotur-philosophie' },
  ),
);
