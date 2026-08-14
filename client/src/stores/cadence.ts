import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// « Mon voyage » (A26 / M112) : la vision de CHAQUE voyageur, en local (persist par appareil). La cadence est la
// porte d'entrée simple (rusher ↔ flâner) qui pilotera tous les budgets temps au flip. Les incontournables sont
// les lieux où je veux vraiment du temps (épinglés). Au flip, ces réglages nourrissent le moteur (gaté DSN).
interface EtatCadence {
  /** Densité des journées (nom technique interne « cadence », M118) : 0 = journées légères (on prend le temps),
   * 100 = journées denses (on enchaîne). C'est une moyenne ; le composeur alternera les rythmes au flip. */
  cadence: number;
  /** osm_id des lieux où « je veux vraiment du temps ». */
  incontournables: string[];
  setCadence: (v: number) => void;
  epingler: (osmId: string) => void;
  estEpingle: (osmId: string) => boolean;
}

export const useCadence = create<EtatCadence>()(
  persist(
    (set, get) => ({
      cadence: 50,
      incontournables: [],
      setCadence: (v) => set({ cadence: v }),
      epingler: (osmId) =>
        set((s) => ({
          incontournables: s.incontournables.includes(osmId)
            ? s.incontournables.filter((x) => x !== osmId)
            : [...s.incontournables, osmId],
        })),
      estEpingle: (osmId) => get().incontournables.includes(osmId),
    }),
    { name: 'barjotur-cadence' },
  ),
);
