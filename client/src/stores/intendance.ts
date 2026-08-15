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

// AUDIT-FRONT P0 #2 (Étude Préparer) : Charge utile + Trousseau.
/** Capacité utile sûre du van, en kg. ESTIMATION prudente à confirmer (R1). */
export const CHARGE_SURE_KG = 430;

export interface AffaireChargee {
  id: string;
  objet: string;
  qui: string;
  /** Poids en kg (0 si inconnu). */
  poids: number;
}

export interface AffaireTrousseau {
  id: string;
  affaire: string;
  qui: string;
}

interface EtatIntendance {
  recettes: Recette[];
  menus: MenuItem[];
  materiel: MaterielItem[];
  charge: AffaireChargee[];
  trousseau: AffaireTrousseau[];
  ajouterRecette: (r: Omit<Recette, 'id'>) => void;
  supprimerRecette: (id: string) => void;
  ajouterMenu: (m: Omit<MenuItem, 'id'>) => void;
  supprimerMenu: (id: string) => void;
  ajouterMateriel: (libelle: string) => void;
  basculerMateriel: (id: string) => void;
  supprimerMateriel: (id: string) => void;
  ajouterCharge: (a: Omit<AffaireChargee, 'id'>) => void;
  retirerCharge: (id: string) => void;
  ajouterTrousseau: (a: Omit<AffaireTrousseau, 'id'>) => void;
  retirerTrousseau: (id: string) => void;
  /** Hydratation serveur (C-17 sync) : remplace l'intendance par le blob serveur (source versionnée). */
  remplacer: (blob: { recettes: Recette[]; menus: MenuItem[]; materiel: MaterielItem[] }) => void;
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
      charge: [],
      trousseau: [],
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
      ajouterCharge: (a) => set((s) => ({ charge: [...s.charge, { ...a, id: id() }] })),
      retirerCharge: (cid) => set((s) => ({ charge: s.charge.filter((a) => a.id !== cid) })),
      ajouterTrousseau: (a) => set((s) => ({ trousseau: [...s.trousseau, { ...a, id: id() }] })),
      retirerTrousseau: (tid) => set((s) => ({ trousseau: s.trousseau.filter((a) => a.id !== tid) })),
      remplacer: (blob) => set({ recettes: blob.recettes, menus: blob.menus, materiel: blob.materiel }),
    }),
    { name: 'barjotur-intendance' },
  ),
);

/** Somme des poids chargés (kg). */
export function poidsTotal(charge: AffaireChargee[]): number {
  return charge.reduce((t, a) => t + (Number.isFinite(a.poids) ? a.poids : 0), 0);
}
