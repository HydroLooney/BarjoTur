// Contrats du composeur (C06). Le BFF est un passe-plat du sidecar Python (OR-Tools) : il ne retraite pas
// la sémantique. Formes relevées par B (B010). geom/fige/etapes restent `unknown` tant que le détail n'est pas figé.

/** Corps de POST /api/composer (validation BFF). */
export interface ComposeInput {
  /** base_id des bases candidates. Non vide. */
  bases: number[];
  /** Archétype ; absent = signature neutre équilibrée. */
  archetype_key?: string | null;
  /** Calculer l'agenda journée (micro-OP jour). Défaut true. */
  avec_agenda?: boolean;
  /** Persister le résultat dans fige. Défaut false. */
  persister?: boolean;
}

/** Métriques renvoyées par le sidecar. */
export interface ComposeMeta {
  n_bases: number;
  nuits: number;
  value: number;
  drive_h: number;
  leg_max_h?: number;
}

/** Réponse du sidecar (passe-plat). `fige` renvoyé si persister=true. */
export interface ComposeReponse {
  ok: boolean;
  error?: string;
  compose?: ComposeMeta;
  n_etapes?: number;
  fige?: unknown;
  route?: number[];
  nights_par_base?: Record<string, number>;
  nuits_deficit?: number;
  geom_sequence?: number[];
  geom?: unknown;
  etapes?: unknown[];
  agenda_error?: string;
}
