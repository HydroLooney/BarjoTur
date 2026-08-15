import { Link } from 'react-router-dom';
import type { CataloguePoi, VoteTier } from '@barjotur/shared';
import { useMemoireExploration } from '@/stores/memoire-exploration';

// Rail « À revoir » (SPEC-CONSOLIDEE §A, audit Explorer) : les lieux DÉJÀ OUVERTS mais PAS ENCORE VOTÉS —
// pour revenir finir ce qu'on a commencé à regarder. Masqué s'il est vide (rien à revoir). Même facture que
// les rails de recommandation (horizontal, 30 tuiles max). Reçoit le catalogue filtré + mes votes (surface
// unique) ; lit la mémoire d'exploration en local.
const MAX_TUILES = 30;

export function RailARevoir({
  pois,
  mesTiers,
}: {
  pois: CataloguePoi[];
  mesTiers: Record<string, VoteTier>;
}) {
  const explores = useMemoireExploration((s) => s.explores);

  const aRevoir = pois
    .filter((p) => explores.includes(p.id) && !mesTiers[`p:${p.id}`])
    .slice(0, MAX_TUILES);

  if (aRevoir.length === 0) return null;

  return (
    <section aria-label="À revoir" className="space-y-1">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h2 className="text-sm font-medium">À revoir</h2>
        <span className="text-xs text-muted-foreground">Vous les avez ouverts sans encore voter.</span>
      </div>
      <ul className="flex gap-2 overflow-x-auto pb-1">
        {aRevoir.map((poi) => (
          <li key={poi.id} className="w-52 shrink-0">
            <Link
              to={`/explorer/${encodeURIComponent(poi.id)}`}
              className="block h-full rounded-lg border border-border bg-card p-3 hover:bg-muted"
            >
              <p className="font-medium">{poi.nom}</p>
              {poi.categorie || poi.region ? (
                <p className="text-xs text-muted-foreground">
                  {[poi.categorie, poi.region].filter(Boolean).join(' · ')}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-accent">à revoir</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
