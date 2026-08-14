import { create } from 'zustand';

// Contexte voyage (multi-voyage-ready, A18 §7.3 / M048). Le front ne suppose JAMAIS un voyage unique :
// toute vue/requête liée à un voyage se lit dans le cadre du `voyageId` courant. À la mise en ligne un
// seul voyage est exposé (défaut 1, le roadtrip Norvège), mais le modèle est prêt pour plusieurs tribus
// (l'organisateur en changera plus tard, post-Go-Live). Aucun codage en dur d'un voyage unique.
interface EtatVoyageContexte {
  voyageId: number;
  choisirVoyage: (id: number) => void;
}

export const useVoyageContexte = create<EtatVoyageContexte>((set) => ({
  voyageId: 1,
  choisirVoyage: (id) => set({ voyageId: id }),
}));
