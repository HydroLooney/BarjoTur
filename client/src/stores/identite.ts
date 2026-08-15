import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Qualification, Role, Whoami } from '@barjotur/shared';

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
  /** Adulte / enfant : conditionne le financier détaillé (T043, `peut`). null si whoami ne le porte pas encore. */
  qualification: Qualification | null;
  /** Conducteur (attribut orthogonal au rôle) : gate `regler_conduite` côté front. Défaut false (non conducteur). */
  conducteur: boolean;
  depuisWhoami: (code: string, w: Whoami) => void;
  /** Identité de DÉMO (captures QA hors BFF), anonymisée. À n'appeler que sous `import.meta.env.DEV`. */
  demoDev: (role: Role) => void;
  deconnecter: () => void;
}

// Prénoms FICTIFS pour la démo (M184 : jamais la famille réelle). Un par rôle capturable.
const PRENOM_DEMO: Record<string, string> = {
  organisateur_principal: 'Alex',
  organisateur: 'Alex',
  voyageur: 'Sam',
  demo: 'Léa',
  invite: 'Noé',
};

// Identite du voyageur (etat de session UI). L'autorite reste serveur : une mutation est refusee sans
// jeton valide, quoi que dise ce store. Aucun PIN ne transite ni n'est stocke ici.
// PERSISTÉE (M468 §1) : l'app est PRIVÉE, on n'entre que par le lien perso /app/<token>/. Une fois entré, on
// persiste l'identité (le token `code` + le profil résolu par whoami) pour que le voyageur RESTE identifié au
// rechargement (sinon reload = perte d'identité). Sans identité persistée ni token à l'URL → page d'accès privé
// (GardeAcces). Le token EST le sésame : le persister = « rester connecté », comme tout lien perso. L'autorité
// des écritures reste serveur (un token révoqué → mutations refusées, un nouveau /app/<token> écrase).
export const useIdentite = create<EtatIdentite>()(
  persist(
    (set) => ({
      code: null,
      membreId: null,
      prenom: null,
      role: null,
      qualification: null,
      conducteur: false,
  // whoami porte la qualification (adulte/enfant), dérivée par B de `membre.membre` (M082/B042). On la lit
  // telle quelle (repli null si absente) : elle active le masque enfant du budget détaillé côté rendu, en
  // cohérence avec l'autorité serveur (`peut`).
  depuisWhoami: (code, w) =>
    set({
      code,
      membreId: w.membre_id,
      prenom: w.prenom,
      role: normaliserRole(w.role),
      qualification: w.qualification ?? null,
      conducteur: w.conducteur === true,
    }),
  // Identité fictive pour les captures QA sans BFF (M184) : code factice, prénom fictif, adulte (pour voir le
    // budget). L'autorité reste serveur : ce raccourci ne débloque AUCUNE écriture réelle (le BFF refuse le code).
  // Le principal est conducteur par defaut (Guillaume) ; les autres roles non, sauf designation reelle (whoami).
  demoDev: (role) =>
    set({
      code: 'demo-dev',
      membreId: 0,
      prenom: PRENOM_DEMO[role] ?? 'Sam',
      role,
      qualification: 'adulte',
      conducteur: role === 'organisateur_principal',
    }),
      deconnecter: () =>
        set({ code: null, membreId: null, prenom: null, role: null, qualification: null, conducteur: false }),
    }),
    {
      name: 'barjotur-identite',
      // On persiste le profil résolu (pas les fonctions). Le `code` = le token, garant de « rester identifié ».
      partialize: (s) => ({
        code: s.code,
        membreId: s.membreId,
        prenom: s.prenom,
        role: s.role,
        qualification: s.qualification,
        conducteur: s.conducteur,
      }),
    },
  ),
);
