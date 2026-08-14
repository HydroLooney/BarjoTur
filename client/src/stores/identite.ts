import { create } from 'zustand';
import type { Role, Whoami } from '@barjotur/shared';

const ROLES: readonly Role[] = ['organisateur_principal', 'organisateur', 'voyageur', 'demo', 'invite'];

// whoami renvoie desormais le role NORMALISE au vocabulaire du contrat (B035, cote BFF). On le prend tel
// quel ; ce garde reste en defense en profondeur (un role inconnu retombe sur 'voyageur', jamais organisateur).
function normaliserRole(r: string): Role {
  return (ROLES as readonly string[]).includes(r) ? (r as Role) : 'voyageur';
}

interface EtatIdentite {
  /** Lien perso stable : /app/<code>/<Prenom>. */
  code: string | null;
  membreId: number | null;
  prenom: string | null;
  role: Role | null;
  depuisWhoami: (code: string, w: Whoami) => void;
  deconnecter: () => void;
}

// Identite du voyageur (etat de session UI). L'autorite reste serveur : une mutation est refusee sans
// jeton valide, quoi que dise ce store. Aucun PIN ne transite ni n'est stocke ici.
export const useIdentite = create<EtatIdentite>((set) => ({
  code: null,
  membreId: null,
  prenom: null,
  role: null,
  depuisWhoami: (code, w) =>
    set({ code, membreId: w.membre_id, prenom: w.prenom, role: normaliserRole(w.role) }),
  deconnecter: () => set({ code: null, membreId: null, prenom: null, role: null }),
}));
