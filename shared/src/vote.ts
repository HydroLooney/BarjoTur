// Contrat de vote, aligné sur decision.vote_lieu / vote_variante / vote_circuit (+ *_hist) et sur les
// fonctions RPC réelles de DB2 (api.mes_votes / set_votes / set_vote, vue api.base_vote_weight),
// signatures relevées par B (B002, schema 23/25/49/57/60). Voter n'est jamais gaté PIN (A03).

// ---------------------------------------------------------------------------------------------------
// Grammaire réelle du vote (identité = code_lien texte, cible = ref préfixée, valeur = tier-list)
// ---------------------------------------------------------------------------------------------------

/**
 * Valeurs de tier de vote RÉELLEMENT observées en base (R1) : plus large que le `Tier` TSAB par défaut
 * d'un POI (poi.ts). À garder DISTINCT de `Tier` : ici c'est un classement de préférence posé par un voyageur.
 */
export type VoteTier = 'T' | 'S' | 'A' | 'B' | 'C' | 'D';

/** Préfixe de cible : p = lieu (POI), c = circuit, v = variante. */
export type CibleVotePrefix = 'p' | 'c' | 'v';

/** Référence de cible votée, ex. `p:12345` (osm_id), `c:<circuit_id>`, `v:<variante_code>`. */
export type RefVote = `${CibleVotePrefix}:${string}`;

/** Carte des votes d'un voyageur : ref → tier. (Clés RefVote ; `string` pour tolérer la sérialisation JSON.) */
export type VotesMap = Record<string, VoteTier>;

// --- Résultats des RPC (passe-plat typé ; un `ok:false` métier n'est PAS une panne HTTP) ---

/** api.mes_votes(code) → { tiers }. */
export interface MesVotes {
  tiers: VotesMap;
}

/** api.set_votes(code, tiers) → remplacement complet, last-write-wins, historisé. */
export interface SetVotesResult {
  ok: boolean;
  error?: string;
  lieux: number;
  circuits: number;
  variantes: number;
}

/**
 * api.set_vote(code, ref, tier|null) → unitaire (tier NULL = dévote), quota-aware (M203/M206/M220).
 * `ok:false, error:'quota_plein'` est un ÉTAT MÉTIER : le front propose l'échange, ce n'est pas une erreur serveur.
 */
export interface VoteUnitaireResult {
  ok: boolean;
  action?: 'set' | 'unset';
  error?: string;
  ref?: string;
  tier?: VoteTier | null;
  /** Quotas : plafonds souple/dur et consommation courante. */
  soft?: number;
  hard?: number;
  utilise?: number;
  /** Lieux déjà présents dans le tier visé (pour proposer un échange). */
  lieux_du_tier?: Array<{ ref: string; osm_id: string; nom: string }>;
  /** Enveloppe budgétaire renvoyée par la RPC (forme fixée côté B/budget, opaque ici). */
  budget?: unknown;
}

/** Quotas de vote restants pour un tier (bloc budget de api.mes_lieux_par_tier, B023). */
export interface QuotaTier {
  etat: string;
  hard: number | null;
  soft: number | null;
  utilise: number;
  restant_hard: number | null;
  restant_soft: number | null;
}

/** api.mes_lieux_par_tier : les lieux votés d'un voyageur, groupés par tier, avec le budget restant par tier. */
export interface MesLieuxParTier {
  ok: boolean;
  tiers: Partial<Record<VoteTier, { lieux: unknown[]; budget: QuotaTier }>>;
}

/** Vue api.base_vote_weight : poids agrégé du vote par base, borné [-0.3, +0.5]. */
export interface PoidsVoteBase {
  base_id: number;
  /** vote_weight, borné [-0.3, +0.5]. */
  vote_weight: number;
  n_votes: number;
}

// Alias de compat avec le nom d'API (B002).
export type BaseVoteWeight = PoidsVoteBase;

// ---------------------------------------------------------------------------------------------------
// Forme abstraite (conservée, additif) — utile pour un raisonnement générique sur « un vote »
// ---------------------------------------------------------------------------------------------------

export type CibleVote = 'lieu' | 'variante' | 'circuit';

/** Forme abstraite d'un vote. La grammaire opérationnelle est tier-list (VotesMap) ci-dessus. */
export interface Vote {
  /** Voyageur auteur (identité réelle = code_lien ; id numérique pour l'abstraction interne). */
  voyageurId: number;
  cible: CibleVote;
  cibleId: number;
  valeur: number;
}
