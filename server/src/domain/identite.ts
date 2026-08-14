// Type identité désormais CANONIQUE dans @barjotur/shared/role.ts (câblé par M, M011). Re-export.
// `Whoami` = retour de api.whoami (bootstrap identité depuis le lien perso, non gaté PIN).
//
// NORMALISATION DU RÔLE (M052, option A2) : le physique DB2 (`membre.role`) n'est PAS migré (Q11 : l'identité reste
// canonique derrière une couche). C'est `whoami` qui NORMALISE le rôle physique vers le vocabulaire d'ACCÈS du contrat
// (@barjotur/shared/role.ts). whoami devient ainsi la source de vérité unique du rôle d'accès de l'app.

export type { Whoami } from '@barjotur/shared';

import type { Role } from '@barjotur/shared';

/** Table de correspondance rôle PHYSIQUE (DB2) → rôle d'ACCÈS (contrat). Le lien famille (mamie…) est un attribut
 *  d'affichage distinct, hors rôle d'accès (M052). */
const MAP_ROLE_PHYSIQUE: Readonly<Record<string, Role>> = {
  owner: 'organisateur_principal',
  organisateur_principal: 'organisateur_principal',
  organisateur: 'organisateur',
  mamie: 'voyageur',
  enfant: 'voyageur',
  voyageur: 'voyageur',
  demo: 'demo',
  invite: 'invite',
};

/** Normalise un rôle physique vers le vocabulaire d'accès du contrat. Défaut PRUDENT = `voyageur` : un rôle physique
 *  inconnu n'est JAMAIS organisateur par défaut (M052). Pure. */
export function normaliserRole(physique: string): Role {
  return MAP_ROLE_PHYSIQUE[physique] ?? 'voyageur';
}
