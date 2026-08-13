import { create } from 'zustand';
import type { Role } from '@barjotur/shared';

interface EtatIdentite {
  /** Lien perso stable : /app/<code>/<Prenom>. whoami autoritaire cote serveur. */
  code: string | null;
  prenom: string | null;
  role: Role | null;
  setIdentite: (i: { code: string; prenom: string; role: Role }) => void;
  deconnecter: () => void;
}

// Identite du voyageur (code de lien, role resolu par whoami). Etat UI/session seulement :
// l'autorite reste serveur (un vote/une mutation est refuse sans jeton valide). Aucun PIN ici.
export const useIdentite = create<EtatIdentite>((set) => ({
  code: null,
  prenom: null,
  role: null,
  setIdentite: ({ code, prenom, role }) => set({ code, prenom, role }),
  deconnecter: () => set({ code: null, prenom: null, role: null }),
}));
