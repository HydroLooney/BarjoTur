// Contrats mémoire perso : passe-plat des RPC `api.exploration_*` / `api.collection_*` (migration 002, spec B024/A018).
// Mémoire non destructive, identité = code_lien (jamais le PIN). Écritures idempotentes ; `ok:false` = état métier, pas panne HTTP.

/** Statut d'exploration d'un lieu par un voyageur. */
export type StatutExploration = 'vu' | 'explore';

/** Une marque d'exploration (api.exploration_lire, triée maj_at desc). */
export interface MarqueExploration {
  osm_id: string;
  statut: StatutExploration;
  /** Horodatage ISO de dernière mise à jour. */
  maj_at: string;
}

/** api.exploration_lire(code) → les marques d'un voyageur. */
export interface ExplorationLue {
  ok: boolean;
  marques: MarqueExploration[];
}

/**
 * api.collection_lire(code, cle) → un blob perso versionné (collections C-16, intendance `cle='intendance'` C-17).
 * `contenu` = null si la collection n'existe pas encore (pas une erreur). Forme opaque côté contrat (objet ou tableau JSON).
 */
export interface CollectionLue {
  ok: boolean;
  contenu: unknown | null;
}

/**
 * Enveloppe des RPC d'écriture mémoire perso (`exploration_marquer`, `collection_ecrire`), idempotentes.
 * `ok:false` + `error` est un état métier (ex. statut invalide, code inconnu), le front le lit sans le traiter en panne.
 */
export interface EcritureMemoireResult {
  ok: boolean;
  error?: string;
}
