// Contrats domaine du composeur (côté BFF).
// ComposeReponse = passe-plat du sidecar (Python). Le BFF ne retraite pas la sémantique OR-Tools.
// FigeEnregistreResult = retour de api.fige_enregistrer_systeme (DB2).

/** Corps de POST /api/composer (validation BFF). */
export interface ComposeInput {
  /** Identifiants de bases candidates (base_id). Doit être non vide. */
  bases: number[];
  /** Code d'archétype (si absent : signature neutre équilibrée). */
  archetype_key?: string | null;
  /** Calculer l'agenda journée (micro-OP jour). Par défaut : true. */
  avec_agenda?: boolean;
  /** Calculer et persister le résultat dans fige. Par défaut : false. */
  persister?: boolean;
}

/** Métriques renvoyées par le sidecar (n_bases, nuits, value, drive_h, leg_max_h). */
export interface ComposeMeta {
  n_bases: number;
  nuits: number;
  value: number;
  drive_h: number;
  leg_max_h?: number;
}

/** Réponse complète du sidecar (passe-plat). Le fige est renvoyé si persister=true. */
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
