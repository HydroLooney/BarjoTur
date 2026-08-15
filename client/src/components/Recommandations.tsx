import { Link } from 'react-router-dom';
import type { CataloguePoi, VoteTier } from '@barjotur/shared';
import { construireRails } from '@/lib/recommandations';
import { BoutonVote } from '@/ui/blocs/BoutonVote';

// Rails de recommandation (A20 §11 / M057) : recommander, pas lister à plat. Des rails curés au-dessus du
// parcours libre, chacun disant POURQUOI (R1). Reçoit le catalogue filtré + mes votes (surface unique).
// T042 (M181) : le VOTE est posé DIRECTEMENT sur la tuile de reco (BoutonVote), pas seulement dans la fiche
// (blocage n°1 : le geste doit être évident pour tous). Le lien vers la fiche reste sur le texte, hors du vote.
export function Recommandations({
  pois,
  mesTiers,
}: {
  pois: CataloguePoi[];
  mesTiers: Record<string, VoteTier>;
}) {
  const rails = construireRails(pois, mesTiers);
  if (rails.length === 0) return null;

  return (
    <div className="space-y-4">
      {rails.map((rail) => (
        <section key={rail.cle} aria-label={rail.titre} className="space-y-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h2 className="text-sm font-medium">{rail.titre}</h2>
            <span className="text-xs text-muted-foreground">{rail.description}</span>
          </div>
          <ul className="flex gap-2 overflow-x-auto pb-1">
            {rail.items.map(({ poi, pourquoi }) => (
              <li
                key={poi.id}
                className="flex w-56 shrink-0 flex-col rounded-lg border border-border bg-card p-3 shadow-posee transition-[box-shadow,transform] duration-court ease-doux hover:-translate-y-px hover:shadow-charte"
              >
                <Link to={`/explorer/${encodeURIComponent(poi.id)}`} className="block grow hover:opacity-80">
                  <p className="font-medium">{poi.nom}</p>
                  {poi.categorie || poi.region ? (
                    <p className="text-xs text-muted-foreground">
                      {[poi.categorie, poi.region].filter(Boolean).join(' · ')}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-accent">{pourquoi}</p>
                </Link>
                {poi.votable ? (
                  <div className="mt-2 border-t border-border pt-2" data-guide="boutons-avis">
                    <BoutonVote cible={`p:${poi.id}`} tierDefaut={poi.tier_defaut} />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="text-xs text-muted-foreground">
        « Sur votre route » (les lieux proches de l'itinéraire retenu) s'affichera avec l'itinéraire.
      </p>
    </div>
  );
}
