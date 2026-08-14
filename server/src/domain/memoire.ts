// Mémoire perso du voyageur (B-17/B-18) : exploration (marque vu/exploré d'un POI) et collections génériques
// (un blob jsonb versionné par clé ; l'intendance est la collection cle='intendance', C-17). Identité = code_lien
// seul (jamais le PIN : mémoire perso non destructive, A03/M026). Le backend sert de sync/backup du MVP client-local.
//
// Types locaux au BFF (DTO d'entrée HTTP + passe-plat de sortie). Les RPC (api.exploration_*, api.collection_*)
// sont posées par la migration 002 (A018) et frontées ici sans logique métier.

/** Statuts d'exploration acceptés (miroir du CHECK SQL statut IN ('vu','explore')). */
export type StatutExploration = 'vu' | 'explore';

/** Corps validé de POST exploration (api.exploration_marquer). */
export interface MarqueInput {
  osm_id: string;
  statut: StatutExploration;
}

/** Corps validé d'écriture de collection (api.collection_ecrire) : un blob JSON quelconque (objet ou tableau). */
export type ContenuCollection = Record<string, unknown> | unknown[];
