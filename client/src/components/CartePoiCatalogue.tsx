import type { CataloguePoi } from '@barjotur/shared';
import { Carte, CarteEntete, CarteTitre, CarteContenu } from '@/ui/primitives/card';
import { Badge, type BadgeProps } from '@/ui/primitives/badge';
import { BoutonVote } from '@/ui/blocs/BoutonVote';
import { EtiquetteMiseEnAvant } from '@/components/EtiquetteMiseEnAvant';
import { libelleCategorie, humaniserTexte } from '@/lib/libelles';

interface Props {
  poi: CataloguePoi;
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
export function CartePoiCatalogue({ poi, explore }: Props) {
  return (
    <Carte className="flex flex-col transition-[box-shadow,transform] duration-court ease-doux hover:-translate-y-px hover:shadow-charte">
      <CarteEntete>
        <div className="flex items-start justify-between gap-2">
          <CarteTitre>{humaniserTexte(poi.nom)}</CarteTitre>
          <div className="flex shrink-0 flex-wrap justify-end gap-1">
            <EtiquetteMiseEnAvant score={poi.score_mcda} />
            {poi.tier_defaut ? <Badge variant={varianteBadge(poi.tier_defaut)}>{poi.tier_defaut}</Badge> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
          {libelleCategorie(poi.categorie) ? <span>{libelleCategorie(poi.categorie)}</span> : null}
          {poi.region ? <span>· {poi.region}</span> : null}
          {poi.payant ? <span>· payant</span> : null}
          {explore ? <span className="text-accent">· déjà vu</span> : null}
        </div>
      </CarteEntete>
      {poi.presentation ? (
        <CarteContenu className="grow">
          <p className="line-clamp-3 text-sm text-muted-foreground">{humaniserTexte(poi.presentation)}</p>
        </CarteContenu>
      ) : (
        <div className="grow" />
      )}
      <CarteContenu>
        {poi.votable ? (
          <BoutonVote cible={`p:${poi.id}`} tierDefaut={poi.tier_defaut} />
        ) : (
          <span className="text-xs text-muted-foreground">Repère non votable (service, information).</span>
        )}
      </CarteContenu>
    </Carte>
  );
}
