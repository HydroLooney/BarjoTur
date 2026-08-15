import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Taux de change couronne norvégienne ↔ euro (convertisseur, slice client de #3 budget vivant). Purement local :
// pas d'API de taux (R1 — on n'affiche pas un taux « live » qu'on n'a pas). Le taux est INDICATIF et ÉDITABLE par
// la famille ; on le persiste pour le retrouver d'un jour à l'autre. Défaut prudent, à ajuster avant/pendant le voyage.

interface EtatChange {
  /** Nombre de couronnes (NOK) pour 1 euro. Indicatif, éditable. */
  nokParEur: number;
  setNokParEur: (v: number) => void;
}

/** Défaut indicatif (ordre de grandeur récent NOK/EUR) — À AJUSTER, ce n'est pas un taux en temps réel. */
export const NOK_PAR_EUR_DEFAUT = 11.5;

export const useChange = create<EtatChange>()(
  persist(
    (set) => ({
      nokParEur: NOK_PAR_EUR_DEFAUT,
      setNokParEur: (v) => set({ nokParEur: v > 0 ? v : NOK_PAR_EUR_DEFAUT }),
    }),
    { name: 'barjotur-change' },
  ),
);
