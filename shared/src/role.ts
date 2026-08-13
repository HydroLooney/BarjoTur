// Modèle de rôles et liens perso, amorce du chantier C05, aligné sur A03 et `membre.membre`.

/**
 * Rôles (cf A03, Q01) :
 * - organisateur_principal : unique, détient le PIN maître, arbitre les droits.
 * - organisateur : un ou plusieurs, gèrent liens et paramètres (gaté PIN).
 * - voyageur : rôle de base, qualifié adulte ou enfant.
 * - demo : voit tout, peut voter, mais ses votes ne comptent pas dans le consensus.
 * - invite : voit l'itinéraire retenu, sa carte, la sélection votée.
 */
export type Role = 'organisateur_principal' | 'organisateur' | 'voyageur' | 'demo' | 'invite';

/** Les adultes voient le financier détaillé, pas les enfants. */
export type Qualification = 'adulte' | 'enfant';

export interface Voyageur {
  /** membre.membre.id */
  id: number;
  prenom: string;
  role: Role;
  /** Pertinent surtout pour un voyageur ; null sinon. */
  qualification: Qualification | null;
  /** Lien perso stable : /app/<code>/<Prénom>. Réémis à l'identique, jamais régénéré à la légère. */
  codeLien: string;
  actif: boolean;
}

// Le PIN n'apparaît JAMAIS dans un contrat transporté : il est haché et l'autorité est côté serveur
// (refus de mutation sans jeton). Aucun champ pin/pin_hash ne transite par ce type.

/**
 * Retour de api.whoami : bootstrap d'identité depuis le code_lien (non gaté PIN), relevé par B (B007).
 * `role` est la valeur brute renvoyée par l'API (à rapprocher de `Role` côté consommateur).
 */
export interface Whoami {
  membre_id: number;
  prenom: string;
  role: string;
}
