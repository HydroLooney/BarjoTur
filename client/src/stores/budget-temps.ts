import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Réglages de budget-temps côté écran (M089 / A21), client-local et persistés par appareil. On ne stocke ici
// que les CHOIX de l'utilisateur (durée ajustée d'une visite, flânerie d'un jour, appétits par thème) ; les
// défauts calculés viennent d'A (fixture hors live). Flip-ready : au montage de la stack, ces choix
// remonteront au composeur/budget (B). `remplacer` sert l'hydratation depuis le serveur au flip.
interface EtatBudgetTemps {
  /** Durée retenue (min) par visite, quand l'utilisateur l'a ajustée à la main. */
  dureesParVisite: Record<string, number>;
  /** Flânerie (min) par jour, quand réglée à la main. */
  flanerieParJour: Record<string, number>;
  /** Appétit thématique [0..1] du voyageur courant, par thème. */
  appetits: Record<string, number>;
  setDuree: (visiteId: string, min: number) => void;
  setFlanerie: (jourId: string, min: number) => void;
  setAppetit: (theme: string, valeur: number) => void;
  remplacer: (etat: Partial<Pick<EtatBudgetTemps, 'dureesParVisite' | 'flanerieParJour' | 'appetits'>>) => void;
}

export const useBudgetTemps = create<EtatBudgetTemps>()(
  persist(
    (set) => ({
      dureesParVisite: {},
      flanerieParJour: {},
      appetits: {},
      setDuree: (visiteId, min) =>
        set((s) => ({ dureesParVisite: { ...s.dureesParVisite, [visiteId]: min } })),
      setFlanerie: (jourId, min) =>
        set((s) => ({ flanerieParJour: { ...s.flanerieParJour, [jourId]: min } })),
      setAppetit: (theme, valeur) => set((s) => ({ appetits: { ...s.appetits, [theme]: valeur } })),
      remplacer: (etat) => set((s) => ({ ...s, ...etat })),
    }),
    { name: 'barjotur-budget-temps' },
  ),
);
