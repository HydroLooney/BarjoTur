// Mémoire perso du voyageur (B-17/B-18) : exploration (marque vu/exploré d'un POI) et collections génériques
// (un blob jsonb versionné par clé ; l'intendance est la collection cle='intendance', C-17). Identité = code_lien
// seul (jamais le PIN : mémoire perso non destructive, A03/M026). Le backend sert de sync/backup du MVP client-local.
//
// Les DTO de SORTIE (StatutExploration, ExplorationLue, CollectionLue, EcritureMemoireResult) sont canoniques dans
// @barjotur/shared (M033) : on les réexporte. Restent locaux les DTO d'ENTRÉE HTTP (corps de requête), propres au BFF.

import type { StatutExploration } from '@barjotur/shared';

export type { StatutExploration } from '@barjotur/shared';

/** Corps validé de POST exploration (api.exploration_marquer). */
export interface MarqueInput {
  osm_id: string;
  statut: StatutExploration;
}

/** Corps validé d'écriture de collection (api.collection_ecrire) : un blob JSON quelconque (objet ou tableau). */
export type ContenuCollection = Record<string, unknown> | unknown[];
