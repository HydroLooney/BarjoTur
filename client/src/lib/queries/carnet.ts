import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CarnetProposition, MesLieuxParTier } from '@barjotur/shared';
import { api } from '@/lib/api';

// Carnet de lieux perso (B017/B020, sous /api/carnet/:code/*). Écritures GATÉES PIN (vérifié serveur),
// idempotentes. Le PIN transite dans le corps mais n'est JAMAIS stocké côté client (A03).
// Types canoniques depuis @barjotur/shared (CarnetProposition, MesLieuxParTier) posés par M (M024).

export interface AjoutLieu {
  pin: string;
  nom: string;
  lon: number;
  lat: number;
  categorie?: string;
  sous_categorie?: string;
  presentation?: string;
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
    queryFn: () => api.get<CarnetProposition[]>(`/carnet/${encodeURIComponent(code as string)}/propositions`),
    retry: 0,
  });
}

/** Mes lieux (votes) classés par tier, avec le budget restant par tier. */
export function useMesLieux(code: string | null) {
  return useQuery({
    queryKey: ['carnet', 'mes-lieux', code],
    enabled: !!code,
    queryFn: () => api.get<MesLieuxParTier>(`/carnet/${encodeURIComponent(code as string)}/mes-lieux`),
    retry: 0,
  });
}

/** Ajouter un lieu au carnet (gaté PIN, idempotent). Invalide mes propositions au succès. */
export function useAjouterLieu(code: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lieu: AjoutLieu) =>
      api.post<CarnetProposition>(`/carnet/${encodeURIComponent(code ?? '')}/poi`, lieu, { idempotent: true }),
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
