import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MARGE_SECURITE_PCT, PRIX_DIESEL_BASE } from '@barjotur/shared';

// Réglages carburant + marges (M090/M092, T045), client-local persistés par appareil. La conso de BASE
// (9,5 L/100 km) est une caractéristique fixe du van, pas stockée ici (non éditable). On ne garde que les
// réglages de l'utilisateur : surconsommation %, prix diesel €/L, marge de sécurité %. Flip-ready : au flip,
// ces réglages nourrissent le budget (B, autorité). Défauts : Guillaume (prix 2,00 ; marge prudente 20 %).
interface EtatCarburant {
  surconsoPct: number;
  prixDiesel: number;
  margePct: number;
  /** Ristourne ferry AutoPASS, en % : le ferry payé = plein × (1 − ristourne%). Défaut 0. */
  ristourneAutopassPct: number;
  setSurconso: (v: number) => void;
  setPrix: (v: number) => void;
  setMarge: (v: number) => void;
  setRistourneAutopass: (v: number) => void;
  remplacer: (
    etat: Partial<
      Pick<EtatCarburant, 'surconsoPct' | 'prixDiesel' | 'margePct' | 'ristourneAutopassPct'>
    >,
  ) => void;
}

export const useCarburant = create<EtatCarburant>()(
  persist(
    (set) => ({
      surconsoPct: 0,
      prixDiesel: PRIX_DIESEL_BASE,
      margePct: MARGE_SECURITE_PCT,
      ristourneAutopassPct: 0,
      setSurconso: (v) => set({ surconsoPct: v }),
      setPrix: (v) => set({ prixDiesel: v }),
      setMarge: (v) => set({ margePct: v }),
      setRistourneAutopass: (v) => set({ ristourneAutopassPct: v }),
      remplacer: (etat) => set((s) => ({ ...s, ...etat })),
    }),
    { name: 'barjotur-carburant' },
  ),
);
