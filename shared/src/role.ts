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

/**
 * Rôles BRUTS physiques en DB2 (`membre.membre.role`, écart de vocabulaire v2 — B034/B128) : les membres de la famille
 * portent {owner, mamie, enfant, demo} ; les liens de portée (A34) portent déjà des noms canoniques {voyageur, demo,
 * invite}. `peut()` clé sur le `Role` CANONIQUE → il faut normaliser AVANT. Point d'application UNIQUE = `api.whoami`.
 * Ne JAMAIS appeler `peut()` avec un rôle brut non normalisé (sinon capacités = 0 au flip).
 */
export type RoleBrut = 'owner' | 'mamie' | 'enfant' | Role;

/**
 * Normalise un rôle BRUT DB2 → `Role` canonique + `Qualification` (B128). owner→organisateur_principal (adulte),
 * mamie→voyageur (adulte), enfant→voyageur (enfant), demo→demo ; un rôle déjà canonique passe tel quel. Le statut
 * `conducteur` n'est PAS ici : il est porté par la colonne `membre.conducteur` (migration 013), lu à part par whoami.
 */
export function normaliserRoleBrut(brut: string): { role: Role; qualification: Qualification | null } {
  switch (brut) {
    case 'owner':
      return { role: 'organisateur_principal', qualification: 'adulte' };
    case 'mamie':
      return { role: 'voyageur', qualification: 'adulte' };
    case 'enfant':
      return { role: 'voyageur', qualification: 'enfant' };
    case 'organisateur_principal':
      return { role: 'organisateur_principal', qualification: 'adulte' };
    case 'organisateur':
      return { role: 'organisateur', qualification: 'adulte' };
    case 'voyageur':
      return { role: 'voyageur', qualification: null };
    case 'invite':
      return { role: 'invite', qualification: null };
    case 'demo':
    default:
      return { role: 'demo', qualification: null };
  }
}

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
  /**
   * CONDUCTEUR (attribut orthogonal au rôle, Guillaume 16/08) : seul un conducteur peut régler ce qui touche la
   * conduite (`regler_conduite`). Un conducteur assume s'il autorise ces réglages et à quelles conditions. Défaut :
   * l'organisateur principal (Guillaume) est conducteur ; les autres non, sauf désignation. `undefined` = non conducteur.
   */
  conducteur?: boolean;
}

// Le PIN n'apparaît JAMAIS dans un contrat transporté : il est haché et l'autorité est côté serveur
// (refus de mutation sans jeton). Aucun champ pin/pin_hash ne transite par ce type.

/**
 * Retour de api.whoami : bootstrap d'identité depuis le code_lien (non gaté PIN), relevé par B (B007).
 * `role` est CANONISÉ par le BFF (`normaliserRoleBrut` appliqué à la valeur brute DB2, B129) → c'est un `Role`
 * (à rapprocher de `Role` côté consommateur). Le SQL rend le rôle brut ; la canonisation est au BFF, source unique shared.
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
  /**
   * Conducteur (attribut, colonne `membre.conducteur` migration 013, relevé par whoami/019). Gate `regler_conduite`
   * côté serveur (autorité) ET côté front (afficher/verrouiller les réglages de conduite). Absent/false = non conducteur.
   */
  conducteur?: boolean;
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
  | 'administrer_voyageurs' // panneau T039 : changer un rôle, régénérer un lien, désigner un conducteur
  | 'regler_profils' // éditer les profils de calcul profonds (poids MCDA, signatures d'archétype) — réservé au principal
  | 'regler_composition' // régler les paramètres de COMPOSITION non-conduite (ravitaillement, cadences confort/laverie, seuils) — organisateurs
  | 'regler_conduite' // régler TOUT ce qui touche la conduite (transits, grandes étapes de roulage, cap et fenêtres de conduite, autonomie élec/PPC) — RÉSERVÉ aux conducteurs (attribut), voir `peut`
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
    'regler_composition',
    'voir_budget_detaille',
    'voir_intendance',
  ],
  organisateur: [
    'voter',
    'composer',
    'valider_composition',
    'transitionner_cran',
    'administrer_voyageurs',
    'regler_composition',
    'voir_budget_detaille',
    'voir_intendance',
  ],
  voyageur: ['voter', 'composer', 'voir_budget_detaille', 'voir_intendance'],
  demo: ['voter', 'composer', 'voir_budget_detaille', 'voir_intendance'],
  invite: [],
};

/**
 * Vrai si le rôle porte la capacité. Deux conditions spéciales :
 * - `voir_budget_detaille` est en plus conditionné à la qualification adulte (un enfant ne voit pas le financier).
 * - `regler_conduite` (tout ce qui touche la conduite) N'EST PAS porté par le rôle seul : il exige l'attribut
 *   `conducteur` ET un rôle d'organisateur (« les organisateurs ayant le statut de conducteur », Guillaume 16/08).
 *   Passer `conducteur` en 4e argument pour cette capacité.
 */
export function peut(
  role: Role,
  capacite: Capacite,
  qualification?: Qualification | null,
  conducteur?: boolean,
): boolean {
  if (capacite === 'regler_conduite') {
    return conducteur === true && (role === 'organisateur_principal' || role === 'organisateur');
  }
  if (!CAPACITES_PAR_ROLE[role]?.includes(capacite)) return false;
  if (capacite === 'voir_budget_detaille' && qualification === 'enfant') return false;
  return true;
}

// --- Contraintes médicales d'autonomie (Guillaume 16/08) -----------------------------------------
// Personnelles : CHAQUE voyageur (organisateur compris) peut en déclarer jusqu'à 3, dans SON profil. Le
// composeur les agrège (la plus restrictive lie l'itinéraire). Donnée sensible : éditable par la personne
// elle-même ; l'autorité serveur (B) protège l'écriture. Ex. actuel : Guillaume porte la PPC (apnée).

/** Nature d'une contrainte médicale qui restreint l'autonomie (électricité, réfrigération, sanitaires...). */
export type TypeContrainteMedicale =
  | 'electricite_nuit' // ex. PPC/CPAP : besoin d'électricité chaque nuit → borne les nuits autonomie consécutives
  | 'refrigeration' // médicament à conserver au froid (autonomie frigo limitée)
  | 'sanitaires' // besoin de sanitaires/eau réguliers
  | 'autre';

/**
 * Une contrainte médicale d'un voyageur. `max_nuits_autonomie_consecutives` borne l'autonomie ; 0 = électricité
 * exigée chaque nuit. Le composeur prend le MIN sur tous les voyageurs (le plus restrictif lie). `libelle` reste
 * discret (donnée sensible) ; la valeur médicale précise n'a pas à être exposée aux autres voyageurs.
 */
export interface ContrainteMedicale {
  type: TypeContrainteMedicale;
  /** Borne de nuits en autonomie consécutives imposée par cette contrainte (0 = élec chaque nuit). */
  max_nuits_autonomie_consecutives?: number | null;
  /** Libellé court, choisi par la personne ; facultatif, discret. */
  libelle?: string;
}

/** Le profil personnel d'un voyageur porte jusqu'à 3 contraintes médicales (Guillaume 16/08). */
export const MAX_CONTRAINTES_MEDICALES = 3;

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

/**
 * Réponse de génération d'un lien de partage : le voyageur (dont `codeLien`) plus la portée effective,
 * pour que le front affiche « ce lien = Suggestion, votes non comptés, voit Explorer + Notre Voyage ».
 * Reconstruit côté BFF depuis la demande validée et `PORTEE_DEFAUT` (aucune écriture DB).
 */
export interface LienGenere {
  voyageur: Voyageur;
  portee: PorteeLien;
  /** true pour `membre`, false pour `suggestion`/`vitrine` (aligné sur `PORTEE_DEFAUT[portee].votesComptent`). */
  votesComptent: boolean;
  /** Espaces effectivement visibles ; absent = selon le rôle (un membre voit tout). */
  espacesVisibles?: readonly EspaceId[];
}
