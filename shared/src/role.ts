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
  /**
   * Qualification adulte/enfant du voyageur, renseignée par B depuis `membre.membre`. Permet au client de
   * masquer le budget détaillé à un enfant côté rendu, cohérent avec l'autorité serveur (`peut`). Optionnel :
   * absent ou null tant que B ne le porte pas, le masque enfant repose alors sur la seule autorité serveur.
   */
  qualification?: Qualification | null;
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

// --- Portée d'un lien de partage (A34) -----------------------------------------------------------
// La PORTÉE est l'intention de partage du lien, distincte du rôle (l'identité). Un organisateur génère
// des liens de trois portées ; chaque portée fixe si les votes comptent et ce qui est visible.

/** Les huit espaces de l'app (source unique des identifiants d'espace visibles par un lien). */
export type EspaceId =
  | 'le_voyage'
  | 'explorer'
  | 'mes_envies'
  | 'mon_voyage'
  | 'notre_voyage'
  | 'carte'
  | 'preparatifs'
  | 'reglages';

/**
 * Ce qu'un lien d'invitation ouvre (A34, tranché Guillaume) :
 * - membre : participation pleine, votes COMPTENT (rôle voyageur/organisateur).
 * - suggestion : explore + vote NON compté (l'organisateur le voit) + voit Notre Voyage (rôle demo).
 * - vitrine : lecture seule, carte animée LIVE du voyage courant (rôle invite).
 */
export type PorteeLien = 'membre' | 'suggestion' | 'vitrine';

/** Réglage d'un lien : sa portée, si ses votes comptent, et les espaces qu'il ouvre. */
export interface ReglagePortee {
  portee: PorteeLien;
  /** Les votes de ce lien entrent-ils dans le consensus commun ? (suggestion/vitrine = false). */
  votesComptent: boolean;
  /** Espaces visibles ; `undefined` = selon le rôle (membre voit tout ce que son rôle autorise). */
  espacesVisibles?: readonly EspaceId[];
}

/** Défauts de portée (l'organisateur peut affiner les espaces visibles à la génération). */
export const PORTEE_DEFAUT: Record<PorteeLien, ReglagePortee> = {
  membre: { portee: 'membre', votesComptent: true },
  suggestion: {
    portee: 'suggestion',
    votesComptent: false,
    espacesVisibles: ['explorer', 'notre_voyage'],
  },
  vitrine: { portee: 'vitrine', votesComptent: false, espacesVisibles: ['carte'] },
};

/** Rôle porté par défaut selon la portée du lien généré. */
export const ROLE_PAR_PORTEE: Record<PorteeLien, Role> = {
  membre: 'voyageur',
  suggestion: 'demo',
  vitrine: 'invite',
};

/** POST /api/voyageurs/:voyage_id/lien — générer un lien de partage (organisateur + PIN). */
export interface DemandeGenererLien {
  portee: PorteeLien;
  /** Libellé du lien (prénom pour un membre ; facultatif pour suggestion/vitrine). */
  prenom?: string;
  /** Espaces visibles imposés (sinon `PORTEE_DEFAUT[portee]`). */
  espacesVisibles?: readonly EspaceId[];
  pin: string;
}

/** POST /api/voyageurs/:voyage_id/:code/revoquer — révoquer un lien (organisateur + PIN). Le code meurt. */
export interface DemandeRevoquerLien {
  code: string;
  pin: string;
}
