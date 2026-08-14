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

// --- Administration des voyageurs (T039) ---------------------------------------------------------
// Corps des mutations du panneau organisateur. Le PIN est vérifié côté serveur (autorité B) ; il ne
// sert ici qu'à porter la preuve d'intention jusqu'au contrôle serveur, il n'est jamais stocké côté client.

/** PUT /api/voyageurs/:voyage_id/:membre_id/role — changer le rôle d'un voyageur (organisateur + PIN). */
export interface DemandeRole {
  membre_id: number;
  role: Role;
  pin: string;
}

/** POST /api/voyageurs/:voyage_id/:membre_id/regenerer-lien — réémettre un lien perso (organisateur + PIN). */
export interface DemandeRegenererLien {
  membre_id: number;
  pin: string;
}

// --- Visibilité par rôle (T043) ------------------------------------------------------------------
// Source unique de « qui voit et peut quoi ». Le serveur (B) fait AUTORITÉ (il refuse la mutation
// interdite) ; le client (C) s'en sert pour MONTRER ou MASQUER, sans jamais réinventer la règle.
// Tout se joue sur lien privé : un invité (ou un lien inconnu) n'a aucune capacité active.

export type Capacite =
  | 'voter' // émettre un avis sur un lieu, un circuit, une zone
  | 'composer' // proposer une composition d'itinéraire
  | 'valider_composition' // figer une composition retenue
  | 'transitionner_cran' // faire avancer le fil du voyage (crans, gel, verrou)
  | 'administrer_voyageurs' // panneau T039 : changer un rôle, régénérer un lien
  | 'regler_profils' // éditer les profils de calcul (reporté, réservé au principal)
  | 'voir_budget_detaille' // financier nominatif détaillé
  | 'voir_intendance'; // repas et intendance privée

export const CAPACITES_PAR_ROLE: Record<Role, readonly Capacite[]> = {
  organisateur_principal: [
    'voter',
    'composer',
    'valider_composition',
    'transitionner_cran',
    'administrer_voyageurs',
    'regler_profils',
    'voir_budget_detaille',
    'voir_intendance',
  ],
  organisateur: [
    'voter',
    'composer',
    'valider_composition',
    'transitionner_cran',
    'administrer_voyageurs',
    'voir_budget_detaille',
    'voir_intendance',
  ],
  voyageur: ['voter', 'composer', 'voir_budget_detaille', 'voir_intendance'],
  demo: ['voter', 'composer', 'voir_budget_detaille', 'voir_intendance'],
  invite: [],
};

/**
 * Vrai si le rôle porte la capacité. `voir_budget_detaille` est en plus conditionné à la qualification
 * adulte : un enfant ne voit pas le financier détaillé même s'il est voyageur (cf `Qualification`).
 */
export function peut(role: Role, capacite: Capacite, qualification?: Qualification | null): boolean {
  if (!CAPACITES_PAR_ROLE[role]?.includes(capacite)) return false;
  if (capacite === 'voir_budget_detaille' && qualification === 'enfant') return false;
  return true;
}
