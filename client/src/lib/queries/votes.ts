import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  DemandeEchangeVote,
  DemandePoserHorsBudget,
  EtapeCascade,
  EtatPaniers,
  MesVotes,
  PoidsVoteBase,
  RefVote,
  VoteTier,
  VoteUnitaireResult,
} from '@barjotur/shared';
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

/**
 * Échange de vote ATOMIQUE (M392) : retire un vote d'un cran plein et pose le nouveau au même cran, en UN appel
 * (transaction, pas de fenêtre d'incohérence). Réponse `VoteUnitaireResult` enrichie (`budget`, `recos`) pour le
 * feedback live. Invalide « mes votes » au succès.
 */
export function useEchangerVote(code: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: DemandeEchangeVote) =>
      api.post<VoteUnitaireResult>(`/votes/${encodeURIComponent(code ?? '')}/echanger`, d, { idempotent: true }),
    onSuccess: () => {
      if (code) void qc.invalidateQueries({ queryKey: cleMesVotes(code) });
    },
  });
}

const clePaniers = (code: string) => ['votes', 'paniers', code] as const;

/**
 * État des PANIERS du voyageur (M394/M396) : par tier, dans_budget vs hors_budget (surplus NON compté), et le flag
 * global `budget_a_resoudre` → pilote la notification (badge profil + indicateur Explorer) et l'écran de classement.
 */
export function usePaniers(code: string | null) {
  return useQuery({
    queryKey: clePaniers(code ?? ''),
    enabled: !!code,
    queryFn: () => api.get<EtatPaniers>(`/votes/${encodeURIComponent(code as string)}/paniers`),
  });
}

/**
 * Voie (b) « Régler plus tard » (M394/M396) : accepte le vote en SURPLUS dans le panier hors-budget du tier (non compté
 * tant que non rangé). Réponse `VoteUnitaireResult` ; on invalide « mes votes » ET les paniers (la notification apparaît).
 */
export function usePoserHorsBudget(code: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: DemandePoserHorsBudget) =>
      api.post<VoteUnitaireResult>(`/votes/${encodeURIComponent(code ?? '')}/poser-hors-budget`, d, { idempotent: true }),
    onSuccess: () => {
      if (code) {
        void qc.invalidateQueries({ queryKey: cleMesVotes(code) });
        void qc.invalidateQueries({ queryKey: clePaniers(code) });
      }
    },
  });
}

/**
 * Voie (a) « Rééquilibrer maintenant » (M394/M396/B118) : la SUITE FINIE d'étapes de cascade pour faire de la place au
 * tier `tier` (déclasser jusqu'au plancher B, termine toujours). GET `/votes/:code/cascade/:tier`. `enabled` à la demande
 * (on ne charge la cascade que quand l'utilisateur choisit de rééquilibrer). Dégrade en `[]` avant le flip (B118).
 */
export function useCascade(code: string | null, tier: VoteTier | null) {
  return useQuery({
    queryKey: ['votes', 'cascade', code ?? '', tier ?? ''],
    enabled: !!code && !!tier,
    queryFn: () => api.get<EtapeCascade[]>(`/votes/${encodeURIComponent(code as string)}/cascade/${tier}`),
  });
}

/** Poids de consensus par base (borne [-0.3, +0.5]), pour nuancer la carte/le composeur. */
export function useConsensusBases() {
  return useQuery({
    queryKey: ['votes', 'consensus', 'bases'],
    queryFn: () => api.get<PoidsVoteBase[]>('/votes/consensus/bases'),
  });
}
