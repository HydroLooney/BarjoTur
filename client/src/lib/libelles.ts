// Tableau central des libellés user-facing (M061 / M067). MIROIR du glossaire figé
// (`documentation/glossaire.md`, source de vérité tenue par l'agent rédaction) : un mot par chose, un
// changement en UN endroit qui se propage partout. Enfant-compatible, zéro jargon. Les composants lisent
// ici plutôt que de coder leurs libellés en dur ; adoption incrémentale.

/** Les 7 espaces de l'app (A20), titres explicites pour un enfant. */
export const ESPACES = {
  voyage: 'Le voyage',
  explorer: 'Explorer',
  envies: 'Mes envies',
  trajet: 'Le trajet',
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
