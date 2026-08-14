import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Intendance en CLIENT-LOCAL MVP (C-17) : recettes, menus et matériel du voyage, privés au voyageur,
// stockés en localStorage. Aligné sur la spec B024 : côté backend (gated-A) ce sera UN blob perso
// versionné sous `cle='intendance'`, contenu = { recettes, menus, materiel }. Ici on tient exactement
// cette forme, pour qu'une sync ultérieure soit un simple push du même objet. Rien de destructif.

export interface Recette {
  id: string;
  titre: string;
  ingredients: string;
  notes: string;
}

export interface MenuItem {
  id: string;
  quand: string; // ex « J3 soir », libre au MVP
  plat: string;
}

export interface MaterielItem {
  id: string;
  libelle: string;
  coche: boolean;
}

interface EtatIntendance {
  recettes: Recette[];
  menus: MenuItem[];
  materiel: MaterielItem[];
  ajouterRecette: (r: Omit<Recette, 'id'>) => void;
  supprimerRecette: (id: string) => void;
  ajouterMenu: (m: Omit<MenuItem, 'id'>) => void;
  supprimerMenu: (id: string) => void;
  ajouterMateriel: (libelle: string) => void;
  basculerMateriel: (id: string) => void;
  supprimerMateriel: (id: string) => void;
}

function id(): string {
  return crypto.randomUUID();
}

export const useIntendance = create<EtatIntendance>()(
  persist(
    (set) => ({
      recettes: [],
      menus: [],
      materiel: [],
      ajouterRecette: (r) => set((s) => ({ recettes: [...s.recettes, { ...r, id: id() }] })),
      supprimerRecette: (rid) => set((s) => ({ recettes: s.recettes.filter((r) => r.id !== rid) })),
      ajouterMenu: (m) => set((s) => ({ menus: [...s.menus, { ...m, id: id() }] })),
      supprimerMenu: (mid) => set((s) => ({ menus: s.menus.filter((m) => m.id !== mid) })),
      ajouterMateriel: (libelle) =>
        set((s) => ({ materiel: [...s.materiel, { id: id(), libelle, coche: false }] })),
      basculerMateriel: (mid) =>
        set((s) => ({
          materiel: s.materiel.map((m) => (m.id === mid ? { ...m, coche: !m.coche } : m)),
        })),
      supprimerMateriel: (mid) => set((s) => ({ materiel: s.materiel.filter((m) => m.id !== mid) })),
    }),
    { name: 'barjotur-intendance' },
  ),
);
