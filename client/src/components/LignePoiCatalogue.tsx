import type { CataloguePoi } from '@barjotur/shared';
import { BoutonVote } from '@/ui/blocs/BoutonVote';
import { EtiquetteMiseEnAvant } from '@/components/EtiquetteMiseEnAvant';
import { libelleCategorie, humaniserTexte } from '@/lib/libelles';

// Liste Explorer EN LIGNES (M515, retour Guillaume) : une LIGNE par lieu, dense et scannable, zéro chevauchement —
// nom + `type · zone` + badge (vaut le voyage/détour) + vote inline (T/S/A/B). Remplace la grille de cartes serrées.
// Le nom/type à gauche (tronqué proprement), le badge + le vote à droite (passent à la ligne au besoin, mobile).
export function LignePoiCatalogue({ poi, explore }: { poi: CataloguePoi; explore?: boolean }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border py-2 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{humaniserTexte(poi.nom)}</span>
          <EtiquetteMiseEnAvant score={poi.score_mcda} />
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {[libelleCategorie(poi.categorie), poi.region].filter(Boolean).join(' · ')}
          {poi.payant ? ' · payant' : ''}
          {explore ? ' · déjà vu' : ''}
        </div>
      </div>
      {poi.votable ? (
        <div className="shrink-0">
          <BoutonVote cible={`p:${poi.id}`} tierDefaut={poi.tier_defaut} />
        </div>
      ) : (
        <span className="shrink-0 text-xs text-muted-foreground">repère</span>
      )}
    </li>
  );
}
