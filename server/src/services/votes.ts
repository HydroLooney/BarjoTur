// Service votes : logique métier du port zéro perte (T009). Ne connaît pas Express (pas de req/res).
// Fronte les fonctions api.mes_votes / set_votes / set_vote et la vue api.base_vote_weight de DB2.
//
// Choix de conception (zéro perte) : api.set_vote porte une sémantique riche de quota et d'échange forcé
// (M203/M206/M220). Un `ok:false, error:'quota_plein'` n'est PAS une panne : c'est un état métier que le
// front exploite pour proposer un échange. On le laisse donc passer en données (HTTP 200), on ne le
// transforme pas en erreur. Seuls le lien inconnu (404) et la référence malformée (400) deviennent des erreurs.

import { appelerRpc, argTexte, argJsonb } from '../db/rpc.js';
import { query } from '../db/query.js';
import { Erreurs } from '../http/erreurs.js';
import type {
  VoteTier,
  VotesMap,
  MesVotes,
  VoteUnitaireInput,
  VoteUnitaireResult,
  SetVotesResult,
  PoidsVoteBase,
  RefVote,
} from '../domain/votes.js';

const TIERS_VALIDES: readonly VoteTier[] = ['T', 'S', 'A', 'B', 'C', 'D'];
const REF_MOTIF = /^[pcv]:.+$/;

export function estTierValide(t: unknown): t is VoteTier {
  return typeof t === 'string' && (TIERS_VALIDES as readonly string[]).includes(t);
}

export function validerRef(ref: unknown): RefVote {
  if (typeof ref !== 'string' || !REF_MOTIF.test(ref)) {
    throw Erreurs.requeteInvalide(
      'Référence de vote invalide. Forme attendue : "p:<lieu>", "c:<circuit>" ou "v:<variante>".',
    );
  }
  return ref as RefVote;
}

export function validerTiers(tiers: unknown): VotesMap {
  if (typeof tiers !== 'object' || tiers === null || Array.isArray(tiers)) {
    throw Erreurs.requeteInvalide('Le corps attendu est un objet { "p:123": "S", ... }.');
  }
  const valide: VotesMap = {};
  for (const [cle, val] of Object.entries(tiers as Record<string, unknown>)) {
    if (!REF_MOTIF.test(cle)) {
      throw Erreurs.requeteInvalide(`Clé de vote invalide : ${cle}.`);
    }
    if (!estTierValide(val)) {
      throw Erreurs.requeteInvalide(`Tier invalide pour ${cle} : ${String(val)}.`);
    }
    valide[cle] = val;
  }
  return valide;
}

/** Lit les votes du porteur du lien. 404 si le lien est inconnu ou inactif. */
export async function lireMesVotes(code: string): Promise<MesVotes> {
  const res = await appelerRpc<MesVotes | null>('mes_votes', [argTexte(code)]);
  if (res === null || res === undefined) {
    throw Erreurs.codeInconnu();
  }
  return res;
}

/** Remplace l'intégralité des votes du porteur (dernier écrit gagne, historisé par triggers). */
export async function remplacerMesVotes(code: string, tiersBrut: unknown): Promise<SetVotesResult> {
  const tiers = validerTiers(tiersBrut);
  const res = await appelerRpc<SetVotesResult>('set_votes', [argTexte(code), argJsonb(tiers)]);
  if (res.ok === false && res.error === 'code inconnu') {
    throw Erreurs.codeInconnu();
  }
  return res;
}

/** Pose ou retire (tier absent) un vote unitaire, sans toucher aux autres. Préserve le flux de quota. */
export async function voterUnitaire(code: string, input: VoteUnitaireInput): Promise<VoteUnitaireResult> {
  const ref = validerRef(input.ref);
  const tier = input.tier ?? null;
  if (tier !== null && !estTierValide(tier)) {
    throw Erreurs.requeteInvalide(`Tier invalide : ${String(tier)}.`);
  }
  const res = await appelerRpc<VoteUnitaireResult>('set_vote', [
    argTexte(code),
    argTexte(ref),
    argTexte(tier),
  ]);
  if (res.ok === false) {
    if (res.error === 'code inconnu') throw Erreurs.codeInconnu();
    if (res.error === 'ref invalide' || res.error === 'ref vide') {
      throw Erreurs.requeteInvalide('Référence de vote invalide.');
    }
    // quota_plein et autres états métier : on laisse passer en données (le front propose l'échange).
  }
  return res;
}

/** Poids de vote consensus par base (dérivé, borné [-0.3, +0.5]). Lu depuis la vue exposée. */
export async function lireConsensusParBase(): Promise<PoidsVoteBase[]> {
  return query<PoidsVoteBase>(
    'select base_id, vote_weight, n_votes from api.base_vote_weight order by base_id',
  );
}
