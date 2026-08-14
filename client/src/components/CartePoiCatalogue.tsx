import type { CataloguePoi, VoteTier } from '@barjotur/shared';
import { Carte, CarteEntete, CarteTitre, CarteContenu } from '@/ui/primitives/card';
import { Badge, type BadgeProps } from '@/ui/primitives/badge';
import { SelecteurTier } from '@/ui/blocs/SelecteurTier';
import { EtiquetteMiseEnAvant } from '@/components/EtiquetteMiseEnAvant';

interface Props {
  poi: CataloguePoi;
  monTier: VoteTier | null;
  onVoter: (tier: VoteTier | null) => void;
  /** false si l'identité n'est pas résolue (on affiche le vote mais désactivé). */
  peutVoter: boolean;
  /** true si le POI a déjà été ouvert (mémoire d'exploration A11). */
  explore?: boolean;
}

function varianteBadge(tier: string): BadgeProps['variant'] {
  switch (tier) {
    case 'T':
      return 'tierT';
    case 'S':
      return 'tierS';
    case 'A':
      return 'tierA';
    case 'B':
      return 'tierB';
    default:
      return 'neutre';
  }
}

// Carte d'un POI dans la liste Explorer : nom, tier par défaut, catégorie/région, présentation en clair
// (ce que le lieu EST, sans score brut, A11), et le sélecteur de vote si le lieu est votable. Les lieux
// non votables (repères, services) sont affichés distinctement, sans geste de vote.
export function CartePoiCatalogue({ poi, monTier, onVoter, peutVoter, explore }: Props) {
  return (
    <Carte className="flex flex-col">
      <CarteEntete>
        <div className="flex items-start justify-between gap-2">
          <CarteTitre>{poi.nom}</CarteTitre>
          <div className="flex shrink-0 flex-wrap justify-end gap-1">
            <EtiquetteMiseEnAvant score={poi.score_mcda} />
            {poi.tier_defaut ? <Badge variant={varianteBadge(poi.tier_defaut)}>{poi.tier_defaut}</Badge> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
          {poi.categorie ? <span>{poi.categorie}</span> : null}
          {poi.region ? <span>· {poi.region}</span> : null}
          {poi.payant ? <span>· payant</span> : null}
          {explore ? <span className="text-accent">· déjà vu</span> : null}
        </div>
      </CarteEntete>
      {poi.presentation ? (
        <CarteContenu className="grow">
          <p className="line-clamp-3 text-sm text-muted-foreground">{poi.presentation}</p>
        </CarteContenu>
      ) : (
        <div className="grow" />
      )}
      <CarteContenu>
        {poi.votable ? (
          <SelecteurTier monTier={monTier} tierDefaut={poi.tier_defaut} onChoisir={onVoter} disabled={!peutVoter} />
        ) : (
          <span className="text-xs text-muted-foreground">Repère non votable (service, information).</span>
        )}
      </CarteContenu>
    </Carte>
  );
}
