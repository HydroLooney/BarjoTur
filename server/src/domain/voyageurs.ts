// Admin des voyageurs (T039, M074/M077) — surface PURE : forme du membre brut, mapping vers le contrat Voyageur,
// rôles attribuables. Les contrats Voyageur/Role, les corps DemandeRole/DemandeRegenererLien ET l'autorité de
// visibilité (peut/CAPACITES_PAR_ROLE, T043) sont canoniques dans @barjotur/shared (posés par M, commit 80285c5) :
// on les réexporte. Le serveur (B) fait AUTORITÉ avec la MÊME carte que C affiche (M077) : pas de dérive.

export type { Role, Voyageur, Qualification, Capacite, DemandeRole, DemandeRegenererLien } from '@barjotur/shared';
export { peut, CAPACITES_PAR_ROLE } from '@barjotur/shared';

import type { Role, Voyageur } from '@barjotur/shared';
import { normaliserRole, qualifierDepuisRole } from './identite.js';

/** Ligne brute renvoyée par la RPC de lecture (colonnes physiques de membre.membre ; jamais pin_hash). */
export interface MembreBrut {
  membre_id: number;
  prenom: string;
  role: string;
  code_lien: string;
  actif: boolean;
}

/** Rôles qu'un organisateur peut ATTRIBUER via l'admin. `organisateur_principal` est UNIQUE (posé au seed), donc non
 *  attribuable ici ; le lien famille (mamie/enfant) est un attribut d'affichage hors rôle d'accès (M052). */
const ROLES_ATTRIBUABLES: readonly Role[] = ['organisateur', 'voyageur', 'demo', 'invite'];

/** Vrai si `role` est un rôle d'accès qu'un organisateur peut attribuer (garde le principal unique). Pure. */
export function estRoleAttribuable(role: string): role is Role {
  return (ROLES_ATTRIBUABLES as readonly string[]).includes(role);
}

/** Mappe une ligne membre brute vers le contrat Voyageur : NORMALISE le rôle physique et DÉRIVE la qualification du même
 *  rôle physique (M052/M082, point unique — pas de colonne qualification dédiée). Pure. */
export function versVoyageur(m: MembreBrut): Voyageur {
  return {
    id: m.membre_id,
    prenom: m.prenom,
    role: normaliserRole(m.role),
    qualification: qualifierDepuisRole(m.role),
    codeLien: m.code_lien,
    actif: m.actif,
  };
}
