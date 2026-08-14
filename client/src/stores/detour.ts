import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Sensibilité au détour (A24 / M110), client-local persistée. En minutes de détour qu'on accepte volontiers :
// 0 = on reste efficace, on file ; grand = on s'écarte volontiers pour un beau lieu. Règle l'affichage « glissé
// dans la journée » vs « à vous de vous arrêter » ; au flip, elle nourrira le composeur (B, gaté DSN).
interface EtatDetour {
  sensibilite: number;
  setSensibilite: (v: number) => void;
}

export const useDetour = create<EtatDetour>()(
  persist(
    (set) => ({
      sensibilite: 40,
      setSensibilite: (v) => set({ sensibilite: v }),
    }),
    { name: 'barjotur-detour' },
  ),
);
