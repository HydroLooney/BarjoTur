import { create } from 'zustand';

export type CranParcours = 'idee' | 'explo' | 'vote' | 'composition' | 'logistique' | 'voyage';

export const ORDRE_CRANS: CranParcours[] = [
  'idee',
  'explo',
  'vote',
  'composition',
  'logistique',
  'voyage',
];

interface EtatPipeline {
  cranActuel: CranParcours;
  /** Crans ouverts (accessibles sans PIN). Depart : 'idee' et 'explo' ouverts. */
  cransOuverts: Set<CranParcours>;
  /** true si l'utilisateur a fourni le PIN correct dans cette session (garde UI). */
  pinValideSession: boolean;
  avancerCran: () => void;
  ouvrirCran: (c: CranParcours) => void;
  validerPin: () => void;
  retirerPin: () => void;
}

// Stepper du parcours (C08 / A07). Etat UI seulement (l'autorite reste serveur).
// Les crans verrouilles sont visibles mais non modifiables sans PIN (garde d'UI).
export const usePipeline = create<EtatPipeline>((set) => ({
  cranActuel: 'explo',
  cransOuverts: new Set<CranParcours>(['idee', 'explo']),
  pinValideSession: false,
  avancerCran: () =>
    set((s) => {
      const idx = ORDRE_CRANS.indexOf(s.cranActuel);
      const suivant = ORDRE_CRANS[idx + 1];
      return suivant ? { cranActuel: suivant } : {};
    }),
  ouvrirCran: (c) =>
    set((s) => ({
      cransOuverts: new Set([...s.cransOuverts, c]),
    })),
  validerPin: () => set({ pinValideSession: true }),
  retirerPin: () => set({ pinValideSession: false }),
}));
