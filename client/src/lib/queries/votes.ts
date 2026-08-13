import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MesVotes, PoidsVoteBase, RefVote, VoteTier, VoteUnitaireResult } from '@barjotur/shared';
import { api } from '@/lib/api';

// Hooks de vote, cales sur le contrat B004 et sur les types CANONIQUES de @barjotur/shared/vote
// (poses par M au 21:34). Le vote n'est jamais gate PIN (A03). Aucune redeclaration locale : la
// grammaire (VoteTier, RefVote, VotesMap, resultats RPC) vit dans shared.

const cleMesVotes = (code: string) => ['votes', code] as const;

/** Mes votes (carte ref -> tier). Enabled seulement si le code de lien est connu. */
export function useMesVotes(code: string | null) {
  return useQuery({
    queryKey: cleMesVotes(code ?? ''),
    enabled: !!code,
    queryFn: () => api.get<MesVotes>(`/votes/${encodeURIComponent(code as string)}`),
  });
}

/**
 * Vote unitaire quota-aware. tier absent = devote. Ecriture idempotente (Idempotency-Key).
 * On invalide finement la carte des votes du membre au succes (pas de refetch global).
 * Un `ok:false, error:'quota_plein'` est un ETAT METIER (proposer l'echange), pas une panne.
 */
export function useVoteUnitaire(code: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { ref: RefVote; tier?: VoteTier }) =>
      api.post<VoteUnitaireResult>(`/votes/${encodeURIComponent(code ?? '')}/unitaire`, v, { idempotent: true }),
    onSuccess: () => {
      if (code) void qc.invalidateQueries({ queryKey: cleMesVotes(code) });
    },
  });
}

/** Poids de consensus par base (borne [-0.3, +0.5]), pour nuancer la carte/le composeur. */
export function useConsensusBases() {
  return useQuery({
    queryKey: ['votes', 'consensus', 'bases'],
    queryFn: () => api.get<PoidsVoteBase[]>('/votes/consensus/bases'),
  });
}
