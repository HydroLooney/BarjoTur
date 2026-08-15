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
  /** Quota plein sur le tier visé : le front ouvre l'overlay d'échange (M385/B116). Équivaut à `error:'quota_plein'`. */
  tier_plein?: boolean;
  /** Lieux déjà présents dans le tier visé (pour proposer un échange). */
  lieux_du_tier?: Array<{ ref: string; osm_id: string; nom: string }>;
  /** Enveloppe budgétaire renvoyée par la RPC (budget TSAB du voyageur, consommation vs quota ; forme fixée côté B). */
  budget?: unknown;
  /** Recos personnalisées mises à jour, pour le feedback LIVE au vote/échange sans recharger (M383/B114/B116). */
  recos?: unknown;
}

/**
 * POST /api/votes/:code/echanger — ÉCHANGE ATOMIQUE (M385/B116) : quand un tier est plein, retirer un vote de ce tier et
 * poser un autre au MÊME tier, d'un seul tenant (jamais d'état incohérent). Réponse = `VoteUnitaireResult`
 * (`ok:true` + `budget` + `recos` pour le feedback live). Le voteur = `:code` (whoami, portée/votesComptent côté serveur).
 */
export interface DemandeEchangeVote {
  /** Réf du lieu à RETIRER du tier (ex. `p:12345`). */
  retirer: RefVote;
  /** Réf du lieu à POSER au tier (auto-promotion du nouveau). */
  poser: RefVote;
  /** Le tier concerné (le même pour les deux). */
  tier: VoteTier;
}

// --- Cascade de budget & paniers hors-budget (cas limite Guillaume, M393/M394) --------------------
// Deux voies quand un déclassement tombe sur un tier lui aussi plein : (a) CASCADE jusqu'au plancher B (finie) ;
// (b) PANIER TEMPORAIRE HORS-BUDGET (surplus accepté mais NON compté dans le composeur jusqu'à résolution, R1).

/** Un lieu voté, minimal (pour les paniers/étapes). */
export interface LieuVote {
  ref: string;
  osm_id: string;
  nom: string;
}

/**
 * L'état d'un PANIER (un tier) d'un voyageur : ce qui est dans le budget (compté) vs en surplus hors-budget (NON compté
 * tant que non rangé). `quota = null` = plancher illimité (B). `a_reequilibrer` = ce panier déborde.
 */
export interface PanierTier {
  tier: VoteTier;
  quota: number | null;
  dans_budget: LieuVote[];
  hors_budget: LieuVote[];
  a_reequilibrer: boolean;
}

/**
 * État global des paniers d'un voyageur (GET /api/votes/:code/paniers) : pour l'écran de classement + la notification.
 * `budget_a_resoudre` = au moins un panier déborde → notification visible ; les votes `hors_budget` NE COMPTENT PAS (R1).
 */
export interface EtatPaniers {
  paniers: PanierTier[];
  budget_a_resoudre: boolean;
}

/**
 * Une étape de cascade « Rééquilibrer maintenant » (voie a) : le tier plein `tier` où faire de la place, ses `candidats`
 * à déclasser, et le niveau d'accueil `vers`. Le front enchaîne les étapes jusqu'au plancher B (illimité) → termine toujours.
 */
export interface EtapeCascade {
  tier: VoteTier;
  vers: VoteTier;
  candidats: LieuVote[];
}

/**
 * POST /api/votes/:code/poser-hors-budget — voie (b) « Régler plus tard » : accepte le vote en SURPLUS dans le panier
 * hors-budget du tier (non compté). Réponse = `VoteUnitaireResult` (+ `EtatPaniers` pour la notification).
 */
export interface DemandePoserHorsBudget {
  poser: RefVote;
  tier: VoteTier;
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
  /** Identité résolue du voyageur (racine de la réponse RPC, relevée à la source DB2, B024). */
  membre_id: number;
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
