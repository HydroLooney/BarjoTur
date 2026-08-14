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
  // Réglage fin optionnel (divulgation progressive, M122), borné. Le débutant ne voit que la densité ; qui veut
  // affine. Au flip, les bornes viennent de `BornesSecurite` (shared) ; ici des défauts raisonnables.
  /** Temps sur place, en % de préférence (50 = neutre). */
  dureeSurPlacePct: number;
  /** Flânerie, en % de préférence (30 = modeste). */
  flaneriePct: number;
  /** Plafond d'heures actives par jour (bornes de sécurité). */
  plafondJourH: number;
  setCadence: (v: number) => void;
  epingler: (osmId: string) => void;
  estEpingle: (osmId: string) => boolean;
  setDureeSurPlace: (v: number) => void;
  setFlanerie: (v: number) => void;
  setPlafondJour: (v: number) => void;
}

export const useCadence = create<EtatCadence>()(
  persist(
    (set, get) => ({
      cadence: 50,
      incontournables: [],
      dureeSurPlacePct: 50,
      flaneriePct: 30,
      plafondJourH: 9,
      setCadence: (v) => set({ cadence: v }),
      epingler: (osmId) =>
        set((s) => ({
          incontournables: s.incontournables.includes(osmId)
            ? s.incontournables.filter((x) => x !== osmId)
            : [...s.incontournables, osmId],
        })),
      estEpingle: (osmId) => get().incontournables.includes(osmId),
      setDureeSurPlace: (v) => set({ dureeSurPlacePct: v }),
      setFlanerie: (v) => set({ flaneriePct: v }),
      setPlafondJour: (v) => set({ plafondJourH: v }),
    }),
    { name: 'barjotur-cadence' },
  ),
);
