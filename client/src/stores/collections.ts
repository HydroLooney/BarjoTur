import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Collections perso « légères » (A11 / Q12) : regroupements privés d'un voyageur, PAS un vote (n'entrent pas
// dans le consensus). Stockées en LOCAL (localStorage) pour la 1re couche ; migrables serveur ensuite. Une
// collection = un nom -> liste d'osm_id. Noms de CONTENU par défaut (M201/M184 : jamais une personne ni un rôle
// familial), et pas de collision avec le rail « À revoir » (mémoire d'exploration, distinct).
export const COLLECTIONS_DEFAUT = ['Coups de cœur', 'À ne pas manquer', 'Si beau temps'] as const;

interface EtatCollections {
  collections: Record<string, string[]>;
  basculer: (collection: string, osmId: string) => void;
  creer: (nom: string) => void;
  supprimer: (collection: string) => void;
  /** Hydratation serveur (C-16 sync) : remplace l'état par le blob serveur (source versionnée). */
  remplacer: (collections: Record<string, string[]>) => void;
}

function initiales(): Record<string, string[]> {
  const o: Record<string, string[]> = {};
  for (const c of COLLECTIONS_DEFAUT) o[c] = [];
  return o;
}

export const useCollections = create<EtatCollections>()(
  persist(
    (set) => ({
      collections: initiales(),
      basculer: (collection, osmId) =>
        set((s) => {
          const liste = s.collections[collection] ?? [];
          const dedans = liste.includes(osmId);
          const maj = dedans ? liste.filter((x) => x !== osmId) : [...liste, osmId];
          return { collections: { ...s.collections, [collection]: maj } };
        }),
      creer: (nom) =>
        set((s) => (s.collections[nom] ? {} : { collections: { ...s.collections, [nom]: [] } })),
      supprimer: (collection) =>
        set((s) => {
          const c = { ...s.collections };
          delete c[collection];
          return { collections: c };
        }),
      remplacer: (collections) => set({ collections }),
    }),
    { name: 'barjotur-collections' },
  ),
);
