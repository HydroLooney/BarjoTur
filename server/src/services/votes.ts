// Service votes : logique métier du port zéro perte (T009). Ne connaît pas Express (pas de req/res).
// Fronte les fonctions api.mes_votes / set_votes / set_vote et la vue api.base_vote_weight de DB2.
//
// Choix de conception (zéro perte) : api.set_vote porte une sémantique riche de quota et d'échange forcé
// (M203/M206/M220). Un `ok:false, error:'quota_plein'` n'est PAS une panne : c'est un état métier que le
// front exploite pour proposer un échange. On le laisse donc passer en données (HTTP 200), on ne le
// transforme pas en erreur. Seuls le lien inconnu (404) et la référence malformée (400) deviennent des erreurs.

import { appelerRpc, argTexte, argJsonb, siRpcAbsente } from '../db/rpc.js';
import { query } from '../db/query.js';
import { Erreurs, exigerPresent } from '../http/erreurs.js';
import type {
  VoteTier,
  VotesMap,
  MesVotes,
  VoteUnitaireInput,
  VoteUnitaireResult,
  SetVotesResult,
  PoidsVoteBase,
  RefVote,
  DemandeEchangeVote,
  EtatPaniers,
  EtapeCascade,
  DemandePoserHorsBudget,
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
  return exigerPresent(res, Erreurs.codeInconnu);
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

/** Valide le corps `DemandeEchangeVote { retirer, poser, tier }` (M392). Pure. */
export function validerDemandeEchangeVote(body: unknown): DemandeEchangeVote {
  const c = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const retirer = validerRef(c.retirer);
  const poser = validerRef(c.poser);
  if (!estTierValide(c.tier)) throw Erreurs.requeteInvalide(`Tier invalide : ${String(c.tier)}.`);
  return { retirer, poser, tier: c.tier };
}

/** Échange ATOMIQUE de vote (M392) : retire `retirer` et pose `poser` au même `tier`, en une transaction (RPC
 *  `echanger_vote` au flip). Rend un `VoteUnitaireResult` enrichi (ok + budget + recos, feedback live). Passe-plat. */
export async function echangerVote(
  code: string,
  demande: DemandeEchangeVote,
  rpc = appelerRpc,
): Promise<VoteUnitaireResult> {
  const res = await rpc<VoteUnitaireResult>('echanger_vote', [
    argTexte(code),
    argTexte(demande.retirer),
    argTexte(demande.poser),
    argTexte(demande.tier),
  ]);
  if (res.ok === false) {
    if (res.error === 'code inconnu') throw Erreurs.codeInconnu();
    if (res.error === 'ref invalide' || res.error === 'ref vide') {
      throw Erreurs.requeteInvalide('Référence de vote invalide.');
    }
  }
  return res;
}

// --- Paniers hors-budget & cascade (cas limite Guillaume, M393/M396) ------------------------------
// Deux voies quand un déclassement tombe sur un tier lui aussi plein : (a) CASCADE jusqu'au plancher B (finie) ;
// (b) PANIER HORS-BUDGET (surplus accepté mais NON compté, R1). Le modèle pur/testable vit dans sidecar/quota_vote.py ;
// ici, passe-plats vers les RPC atomiques de DB2. Tant que ces RPC ne sont pas posées (avant le flip), 42883 → défaut
// vide (jamais un surplus compté par accident, jamais un 500) : R1, honnête et dégradant.

/** État vide des paniers : aucun débordement, rien à rééquilibrer. Sert de défaut de dégradation (RPC pas encore posée). */
const PANIERS_VIDES: EtatPaniers = { paniers: [], budget_a_resoudre: false };

/** Lit l'état des paniers d'un voyageur (GET /api/votes/:code/paniers). Passe-plat de la RPC `paniers_lire`. Dégrade en
 *  paniers vides tant que la RPC n'est pas posée (surplus JAMAIS compté par défaut, R1). */
export async function lirePaniers(code: string, rpc = appelerRpc): Promise<EtatPaniers> {
  return siRpcAbsente(rpc<EtatPaniers>('paniers_lire', [argTexte(code)]), PANIERS_VIDES);
}

/** Valide le corps `DemandePoserHorsBudget { poser, tier }` (voie b, M396). Pure. */
export function validerDemandePoserHorsBudget(body: unknown): DemandePoserHorsBudget {
  const c = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const poser = validerRef(c.poser);
  if (!estTierValide(c.tier)) throw Erreurs.requeteInvalide(`Tier invalide : ${String(c.tier)}.`);
  return { poser, tier: c.tier };
}

/** Voie (b) « Régler plus tard » : pose le vote en SURPLUS hors-budget du tier (non compté tant que non rééquilibré).
 *  Passe-plat de la RPC `poser_hors_budget` → `VoteUnitaireResult` enrichi de `EtatPaniers` (pour la notification). */
export async function poserHorsBudget(
  code: string,
  demande: DemandePoserHorsBudget,
  rpc = appelerRpc,
): Promise<VoteUnitaireResult & { paniers: EtatPaniers }> {
  const res = await rpc<VoteUnitaireResult & { paniers: EtatPaniers }>('poser_hors_budget', [
    argTexte(code),
    argTexte(demande.poser),
    argTexte(demande.tier),
  ]);
  if (res.ok === false) {
    if (res.error === 'code inconnu') throw Erreurs.codeInconnu();
    if (res.error === 'ref invalide' || res.error === 'ref vide') {
      throw Erreurs.requeteInvalide('Référence de vote invalide.');
    }
  }
  return res;
}

/** Voie (a) « Rééquilibrer maintenant » : la suite finie d'étapes de déclassement pour faire de la place au `tier`, jusqu'au
 *  plancher B (illimité) → termine toujours. Passe-plat de la RPC `cascade_declassement`. Dégrade en `[]` avant le flip. */
export async function lireCascade(code: string, tier: VoteTier, rpc = appelerRpc): Promise<EtapeCascade[]> {
  return siRpcAbsente(
    rpc<EtapeCascade[]>('cascade_declassement', [argTexte(code), argTexte(tier)]),
    [],
  );
}

/** Poids de vote consensus par base (dérivé, borné [-0.3, +0.5]). Lu depuis la vue exposée. Dégradation : si la vue
 *  `api.base_vote_weight` est absente (base de dev SANS le modèle mcda2/bases dont elle dérive), on rend `[]` (consensus
 *  vide) au lieu d'un 500 — même contrat qu'en prod où la vue existe. 42P01 = undefined_table. */
export async function lireConsensusParBase(): Promise<PoidsVoteBase[]> {
  try {
    return await query<PoidsVoteBase>(
      'select base_id, vote_weight, n_votes from api.base_vote_weight order by base_id',
    );
  } catch (e) {
    if ((e as { code?: string })?.code === '42P01') return [];
    throw e;
  }
}
