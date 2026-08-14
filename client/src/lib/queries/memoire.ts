import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  CollectionLue,
  EcritureMemoireResult,
  ExplorationLue,
  MarqueExploration,
} from '@barjotur/shared';
import { api } from '@/lib/api';

// Mémoire perso serveur (M033, migration 002 live B027) : passe-plat des endpoints
// `GET/POST /api/exploration/:code` et `GET/PUT /api/collection/:code/:cle`. Le BFF enveloppe le
// résultat RPC dans ApiReponse ; la shape RPC (ExplorationLue / CollectionLue) EST le `data` déballé
// par `api.*`, exactement comme carnet/MesLieuxParTier. Identité = code_lien (jamais le PIN, mémoire non
// destructive). Écritures idempotentes. `retry:0` : si le BFF n'est pas up, on ne crashe pas, on no-op.

const urlExploration = (code: string) => `/exploration/${encodeURIComponent(code)}`;
const urlCollection = (code: string, cle: string) =>
  `/collection/${encodeURIComponent(code)}/${encodeURIComponent(cle)}`;

/** Corps d'écriture d'une marque (l'horodatage est posé côté serveur). */
export type MarqueInput = Pick<MarqueExploration, 'osm_id' | 'statut'>;

/** Lecture des marques d'exploration d'un voyageur. `actif` (drapeau sync live) gate l'appel réseau. */
export function useExplorationServeur(code: string | null, actif: boolean) {
  return useQuery({
    queryKey: ['memoire', 'exploration', code],
    enabled: actif && !!code,
    queryFn: () => api.get<ExplorationLue>(urlExploration(code as string)),
    retry: 0,
  });
}

/** Marquer un lieu vu/exploré (idempotent). */
export function useMarquerExploration(code: string | null) {
  return useMutation({
    mutationFn: (m: MarqueInput) =>
      api.post<EcritureMemoireResult>(urlExploration(code ?? ''), m, { idempotent: true }),
  });
}

/** Lecture d'une collection perso (blob versionné). `contenu:null` = collection absente, pas une erreur. */
export function useCollectionServeur(code: string | null, cle: string, actif: boolean) {
  return useQuery({
    queryKey: ['memoire', 'collection', code, cle],
    enabled: actif && !!code,
    queryFn: () => api.get<CollectionLue>(urlCollection(code as string, cle)),
    retry: 0,
  });
}

/** Écriture d'une collection perso (le contenu, objet/tableau JSON, part comme corps ; à confirmer au smoke). */
export function useEcrireCollection(code: string | null, cle: string) {
  return useMutation({
    mutationFn: (contenu: unknown) =>
      api.put<EcritureMemoireResult>(urlCollection(code ?? '', cle), contenu),
  });
}
