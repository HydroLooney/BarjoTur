import type { CranId, Role } from '@barjotur/shared';

// Tableau central des libellés user-facing (M061 / M067). MIROIR du glossaire figé
// (`documentation/glossaire.md`, source de vérité tenue par l'agent rédaction) : un mot par chose, un
// changement en UN endroit qui se propage partout. Enfant-compatible, zéro jargon. Les composants lisent
// ici plutôt que de coder leurs libellés en dur ; adoption incrémentale.

/**
 * Libellés SIMPLES des crans du fil (A18), tranchés par Guillaume (T040 / M070). Les `CranId` du contrat ne
 * changent pas ; seul l'affichage passe à la version enfant-compatible. `BandeauParcours` et `CransParcours`
 * lisent ici, pas le `Cran.libelle` du contrat.
 */
export const CRANS: Record<CranId, string> = {
  cadrage: "L'idée",
  reservation_van: 'Le van',
  exploration: 'Explorer',
  composition: 'Composer',
  logistique: 'Préparer',
  depart: 'Le départ',
};

/** Les 7 espaces de l'app (A20), titres explicites pour un enfant. */
// Ossature de nav V2 (M471, directive Guillaume) : espaces PAR ACTIVITÉ, à plat, chacun une action / une question.
// Accueil hub « Où en est-on ? » par-dessus (M471 (C)) ; frise 21 j dans « Le réel » (M471 (D)). On garde les
// anciens libellés pour la compat des menus perso, mais la barre primaire suit l'ossature d'activité.
export const ESPACES = {
  // Ossature d'activité V2 (M473, référence définitive) :
  accueil: 'Accueil',
  explorer: 'Explorer',
  voter: 'Voter',
  composer: 'Composer',
  notreVoyage: 'Notre voyage',
  preparer: 'Préparer',
  compter: 'Compter',
  coulisses: 'Coulisses',
  // Anciens libellés conservés (menus perso / compat) :
  voyage: 'Le voyage',
  monVoyage: 'Mon voyage',
  envies: 'Mes envies',
  trajet: 'Notre Voyage',
  carte: 'Carte',
  preparatifs: 'Préparatifs',
  reglages: 'Réglages',
} as const;

/**
 * Libellés d'avis (SelecteurTier, sur les tiers T/S/A/B du contrat). EN ATTENTE de l'arbitrage Guillaume
 * (T040) : on garde l'actuel, le glossaire s'y est aligné. Si Guillaume tranche autrement, on change ICI seul.
 */
export const AVIS = {
  T: 'Coup de cœur',
  S: 'Vraiment envie',
  A: 'Bien',
  B: 'Pourquoi pas',
} as const;

/** États d'un cran du parcours (A18), tels qu'ils s'affichent. */
export const ETATS_CRAN = {
  brouillon: 'brouillon',
  valide_modifiable: 'cadenas ouvert',
  valide_verrouille: 'cadenas fermé',
} as const;

/** Titres des rails de recommandation (A20 §11). */
export const RECOMMANDATIONS = {
  incontournables: 'Les incontournables',
  pourChacun: 'Pour chacun',
  famille: 'La famille adore',
  pepites: 'Pépites',
  surRoute: 'Sur votre route',
} as const;

/** Nature d'une étape d'itinéraire (A19). */
export const NATURE_ETAPE = {
  experience: 'expérience',
  transit: 'transit',
} as const;

/**
 * Libellés des rôles d'accès (A03, `shared/role.ts`), affichés dans l'admin des voyageurs (T039).
 * Enfant-compatible, sans jargon. Le rôle technique ne change pas, seul l'affichage passe ici.
 */
export const ROLES_LABEL: Record<Role, string> = {
  organisateur_principal: 'Organisateur en chef',
  organisateur: 'Organisateur',
  voyageur: 'Voyageur',
  demo: 'Démo',
  invite: 'Invité',
};

/** Libellés des modes de déplacement (profils de routage van/piéton/rando/TC), affichés dans Réglages (T038). */
export const PROFILS_MODE = {
  van: 'En van',
  pieton: 'À pied',
  rando: 'En rando',
  tc: 'En transports',
} as const;

export type ModeDeplacement = keyof typeof PROFILS_MODE;
