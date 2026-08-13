import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// Carnet de lieux perso (B017/B020, sous /api/carnet/:code/*). Écritures GATÉES PIN (vérifié serveur),
// idempotentes. Le PIN transite dans le corps mais n'est JAMAIS stocké côté client (A03).
// NOTE : formes de réponse non encore figées dans @barjotur/shared (à demander à M/B) : typage souple ici.

export interface AjoutLieu {
  pin: string;
  nom: string;
  lon: number;
  lat: number;
  categorie?: string;
  sous_categorie?: string;
  presentation?: string;
}

/** Un lieu proposé par le voyageur (provenance « voyageur », confiance basse, votable ensuite). */
export interface LieuPropose {
  nom: string;
  lat: number;
  lon: number;
  osm_id?: string;
  categorie?: string | null;
  statut?: string | null;
  [autre: string]: unknown;
}

export interface Signalement {
  osm_id: string;
  motif: string;
  commentaire?: string;
}

const cleProps = (code: string) => ['carnet', 'propositions', code] as const;

/** Mes propositions de lieux. (NB : l'endpoint attend le fix DB2 A-18 ; retry 0, pas de crash.) */
export function useMesPropositions(code: string | null) {
  return useQuery({
    queryKey: cleProps(code ?? ''),
    enabled: !!code,
    queryFn: () => api.get<LieuPropose[]>(`/carnet/${encodeURIComponent(code as string)}/propositions`),
    retry: 0,
  });
}

/** Mes lieux (votes) classés par tier. */
export function useMesLieux(code: string | null) {
  return useQuery({
    queryKey: ['carnet', 'mes-lieux', code],
    enabled: !!code,
    queryFn: () => api.get<unknown>(`/carnet/${encodeURIComponent(code as string)}/mes-lieux`),
    retry: 0,
  });
}

/** Ajouter un lieu au carnet (gaté PIN, idempotent). Invalide mes propositions au succès. */
export function useAjouterLieu(code: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lieu: AjoutLieu) =>
      api.post<LieuPropose>(`/carnet/${encodeURIComponent(code ?? '')}/poi`, lieu, { idempotent: true }),
    onSuccess: () => {
      if (code) void qc.invalidateQueries({ queryKey: cleProps(code) });
    },
  });
}

/** Signaler un POI (gaté PIN, idempotent). */
export function useSignaler(code: string | null) {
  return useMutation({
    mutationFn: (s: Signalement) =>
      api.post<unknown>(`/carnet/${encodeURIComponent(code ?? '')}/signaler`, s, { idempotent: true }),
  });
}
