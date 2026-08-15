// Type identité CANONIQUE dans @barjotur/shared/role.ts. Re-export + normalisation via la SOURCE UNIQUE shared
// `normaliserRoleBrut` (M420) : le rôle physique DB2 (`membre.role` : owner/mamie/enfant/demo/…) → rôle d'ACCÈS canonique
// + qualification. Le BFF (services/identite.ts lireWhoami) est le POINT D'APPLICATION UNIQUE ; whoami fournit le rôle brut
// + l'attribut `conducteur` (colonne membre.conducteur, 013/019), lu à part.

import { normaliserRoleBrut } from '@barjotur/shared';
import type { Role, Qualification, Whoami } from '@barjotur/shared';

export type { Whoami };

/** Retour BRUT de api.whoami (M052/019) : rôle PHYSIQUE (non normalisé) + attribut conducteur (colonne membre.conducteur). */
export interface WhoamiBrut {
  membre_id: number;
  prenom: string;
  role: string;
  conducteur?: boolean;
}

// `conducteur` est désormais dans le contrat shared `Whoami` (M423) → plus de type BFF-local : lireWhoami rend `Whoami`.

/** Normalise un rôle physique DB2 vers le rôle d'accès canonique. Délègue à la SOURCE UNIQUE shared (M420). Pure. */
export function normaliserRole(physique: string): Role {
  return normaliserRoleBrut(physique).role;
}

/** Dérive la qualification (adulte/enfant/null) du rôle physique. Délègue à la SOURCE UNIQUE shared (M420). Pure. */
export function qualifierDepuisRole(physique: string): Qualification | null {
  return normaliserRoleBrut(physique).qualification;
}
