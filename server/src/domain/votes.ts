// Les types de vote sont désormais CANONIQUES dans @barjotur/shared (câblés par le Maître suite à B002).
// Ce module ne redéclare plus rien : il re-exporte le contrat partagé, plus le seul DTO d'ENTRÉE propre au BFF
// (le corps d'un vote unitaire reçu en HTTP), qui n'a pas vocation à voyager côté front.

export type {
  VoteTier,
  CibleVotePrefix,
  RefVote,
  VotesMap,
  MesVotes,
  SetVotesResult,
  VoteUnitaireResult,
  PoidsVoteBase,
  DemandeEchangeVote,
  LieuVote,
  PanierTier,
  EtatPaniers,
  EtapeCascade,
  DemandePoserHorsBudget,
} from '@barjotur/shared';

import type { RefVote, VoteTier } from '@barjotur/shared';

/** Corps d'un vote unitaire reçu par le BFF (api.set_vote). tier absent ou null = dévote. */
export interface VoteUnitaireInput {
  ref: RefVote;
  tier?: VoteTier | null;
}
