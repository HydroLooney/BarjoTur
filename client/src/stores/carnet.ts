import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Carnet de notes (A33 / M158 / M160) : notes PRIVÉES par voyageur, gardées en local (persist par appareil).
// Tranché, ne bouge pas avec la restructure « Notre Voyage ». Le partage au collectif (« épingler une note »)
// viendra avec la sync collaborative (gaté) ; ici tout reste privé. `remplacer` = hydratation au flip.
export interface Note {
  id: string;
  texte: string;
  /** Épinglée au collectif (partagée) — pour l'instant toujours false (partage à venir). */
  partagee: boolean;
}

interface EtatCarnet {
  notes: Note[];
  ajouter: (texte: string) => void;
  modifier: (id: string, texte: string) => void;
  supprimer: (id: string) => void;
  remplacer: (notes: Note[]) => void;
}

function nouvelId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `n-${Math.round(Math.random() * 1e9).toString(36)}`;
}

export const useCarnet = create<EtatCarnet>()(
  persist(
    (set) => ({
      notes: [],
      ajouter: (texte) =>
        set((s) => {
          const t = texte.trim();
          return t.length === 0 ? s : { notes: [{ id: nouvelId(), texte: t, partagee: false }, ...s.notes] };
        }),
      modifier: (id, texte) =>
        set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, texte } : n)) })),
      supprimer: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),
      remplacer: (notes) => set({ notes }),
    }),
    { name: 'barjotur-carnet' },
  ),
);
