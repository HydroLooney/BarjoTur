import { useState } from 'react';
import type { RefVote, VoteTier } from '@barjotur/shared';
import { useIdentite } from '@/stores/identite';
import { usePeut } from '@/hooks/usePeut';
import { useMesVotes, useVoteUnitaire, useEchangerVote, usePoserHorsBudget, useCascade } from '@/lib/queries/votes';
import { SelecteurTier } from '@/ui/blocs/SelecteurTier';
import { OverlayEchange } from '@/ui/blocs/OverlayEchange';
import { cn } from '@/lib/utils';

// BoutonVote (design-system unifié, SPEC-CONSOLIDEE §A + fork #5) : le geste de vote CENTRALISÉ, autonome et
// VISIBLE d'emblée, à déposer partout (tuile de reco, ligne de liste, fiche) sans que chaque parent recâble la
// mutation, le quota et la lecture de « mon vote ». Il lit l'identité, mes votes (react-query, cache partagé
// entre toutes les instances : un seul fetch) et pilote la mutation quota-aware. Le plafond plein (`quota_plein`)
// est un ÉTAT MÉTIER (R1) : on propose l'échange en clair, ce n'est pas une panne. Voter n'est jamais gaté PIN (A03).

interface Props {
  /** Cible votée, ex. `p:12345` (POI), `c:<id>` (circuit), `v:<code>` (variante). PAS `ref` (réservé React). */
  cible: RefVote;
  /** Tier par défaut du lieu, affiché DISTINCTEMENT et jamais écrasé (A11). */
  tierDefaut?: string | null;
  /** Nom du lieu voté, pour l'overlay d'échange (« remplacer par … »). */
  nom?: string;
  /** Désactive le geste même si le voyageur peut voter (lieu non votable géré en amont). */
  disabled?: boolean;
  className?: string;
}

interface QuotaPlein {
  tier: VoteTier;
  lieux: Array<{ ref: string; osm_id: string; nom: string }>;
}

export function BoutonVote({ cible, tierDefaut = null, nom, disabled, className }: Props) {
  const code = useIdentite((s) => s.code);
  const peutVoter = usePeut('voter');
  const { data: mesVotes } = useMesVotes(code);
  const voter = useVoteUnitaire(code);
  const echangeur = useEchangerVote(code);
  const horsBudget = usePoserHorsBudget(code);
  const [quota, setQuota] = useState<QuotaPlein | null>(null);
  // Index d'étape de la cascade (voie a) ; null = pas en cascade.
  const [etapeIdx, setEtapeIdx] = useState<number | null>(null);
  // Cascade préchargée dès qu'un cran est plein (voie a « Rééquilibrer maintenant » instantanée).
  const cascadeQ = useCascade(code, quota?.tier ?? null);

  const monTier = (mesVotes?.tiers[cible] as VoteTier | undefined) ?? null;

  async function choisir(tier: VoteTier | null) {
    setQuota(null);
    const res = await voter.mutateAsync({ ref: cible, tier: tier ?? undefined });
    if (!res.ok && res.error === 'quota_plein' && tier) {
      setQuota({ tier, lieux: res.lieux_du_tier ?? [] });
    }
  }

  // Échange (M385/M392) : retire l'ancien du cran plein et pose le nouveau au même cran, en UN appel ATOMIQUE
  // (`POST /votes/:code/echanger`, transaction — zéro fenêtre d'incohérence). Le budget + « mon vote » + recos se
  // remettent à jour au succès (feedback live via `VoteUnitaireResult`).
  async function echanger(ancienRef: string) {
    if (!quota) return;
    await echangeur.mutateAsync({ retirer: ancienRef as RefVote, poser: cible, tier: quota.tier });
    fermer();
  }

  // Voie (b) « Régler plus tard » (M394) : accepte le vote en SURPLUS hors-budget (non compté) → la notification
  // « panier à rééquilibrer » apparaîtra (usePaniers invalidé). Pas de cascade imposée, retour immédiat au contexte.
  async function reglerPlusTard() {
    if (!quota) return;
    await horsBudget.mutateAsync({ poser: cible, tier: quota.tier });
    fermer();
  }

  function fermer() {
    setQuota(null);
    setEtapeIdx(null);
  }

  // Voie (a) « Rééquilibrer maintenant » (M394/M400) : entre en mode cascade sur les étapes préchargées.
  function rebalancer() {
    if (cascadeQ.data && cascadeQ.data.length > 0) setEtapeIdx(0);
  }

  // Une étape de cascade : déclasse le candidat choisi vers le cran d'accueil ; à la dernière étape, la place est faite
  // → on pose enfin le nouveau vote au cran de tête. Optimiste, feedback live via l'invalidation.
  async function descendre(candidatRef: string) {
    const steps = cascadeQ.data;
    if (!steps || etapeIdx === null || !quota) return;
    const step = steps[etapeIdx];
    if (!step) return;
    await voter.mutateAsync({ ref: candidatRef as RefVote, tier: step.vers });
    const suivant = etapeIdx + 1;
    if (suivant < steps.length) {
      setEtapeIdx(suivant);
    } else {
      await voter.mutateAsync({ ref: cible, tier: quota.tier });
      fermer();
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      <SelecteurTier
        monTier={monTier}
        tierDefaut={tierDefaut}
        onChoisir={(t) => void choisir(t)}
        disabled={disabled || !peutVoter || voter.isPending}
      />
      {quota ? (
        <OverlayEchange
          tier={quota.tier}
          lieux={quota.lieux}
          nouveauNom={nom}
          enCours={echangeur.isPending || horsBudget.isPending || voter.isPending}
          onRetirer={(ref) => void echanger(ref)}
          onReglerPlusTard={() => void reglerPlusTard()}
          onRebalancer={cascadeQ.data && cascadeQ.data.length > 0 ? () => rebalancer() : undefined}
          cascade={
            etapeIdx !== null && cascadeQ.data && cascadeQ.data[etapeIdx]
              ? { etape: cascadeQ.data[etapeIdx], index: etapeIdx, total: cascadeQ.data.length }
              : null
          }
          onDescendre={(ref) => void descendre(ref)}
          onAnnuler={fermer}
        />
      ) : null}
    </div>
  );
}
