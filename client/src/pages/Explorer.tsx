import { useEffect, useMemo, useState } from 'react';
import type { CataloguePoi, VoteTier } from '@barjotur/shared';
import { useCatalogue } from '@/lib/queries/catalogue';
import { filtrerCatalogue } from '@/lib/filtrer-catalogue';
import { useExplorer } from '@/stores/explorer';
import { useIdentite } from '@/stores/identite';
import { useMesVotes, useVoteUnitaire } from '@/lib/queries/votes';
import { BarreFiltres } from '@/components/BarreFiltres';
import { CartePoiCatalogue } from '@/components/CartePoiCatalogue';
import { cn } from '@/lib/utils';

const ONGLETS = [
  { cle: 'liste', libelle: 'Liste' },
  { cle: 'carte', libelle: 'Carte' },
] as const;

// Explorer (C15 / A11) : découverte multi-entrées. Première couche = LISTE facettée avec vote posable
// depuis chaque carte. La carte tous-POI (couche distincte votables/non-votables) arrive à l'itération
// suivante ; l'onglet est déjà là. Mémoire d'exploration (exploré/voté serveur) = couche suivante aussi.
export default function Explorer() {
  const { data, isLoading, isError } = useCatalogue();

  // Fixture de dev (chargée dynamiquement, absente de la prod) : vérif visuelle de la liste sans BFF.
  const [demoPois, setDemoPois] = useState<CataloguePoi[] | null>(null);
  useEffect(() => {
    const demo = import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo');
    if (demo && !data) void import('@/lib/fixtures/catalogue-demo').then((m) => setDemoPois(m.catalogueDemo));
  }, [data]);

  const pois = data ?? demoPois ?? [];
  const onglet = useExplorer((s) => s.onglet);
  const setOnglet = useExplorer((s) => s.setOnglet);
  const filtres = useExplorer((s) => s.filtres);
  const liste = useMemo(() => filtrerCatalogue(pois, filtres), [pois, filtres]);

  const code = useIdentite((s) => s.code);
  const { data: mesVotes } = useMesVotes(code);
  const voter = useVoteUnitaire(code);

  const monTierPour = (osmId: string): VoteTier | null => {
    const v = mesVotes?.tiers[`p:${osmId}`];
    return v ?? null;
  };

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="font-serif text-2xl">Explorer</h1>
        <span className="text-sm text-muted-foreground">
          {liste.length} lieu{liste.length === 1 ? '' : 'x'}
        </span>
      </div>

      <div className="flex gap-1 border-b border-border">
        {ONGLETS.map((o) => (
          <button
            key={o.cle}
            type="button"
            onClick={() => setOnglet(o.cle)}
            className={cn(
              'px-3 py-2 text-sm transition-colors',
              onglet === o.cle
                ? 'border-b-2 border-primary font-medium text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.libelle}
          </button>
        ))}
      </div>

      {onglet === 'carte' ? (
        <p className="text-muted-foreground">La carte tous-POI (couches votables et repères) arrive à l'itération suivante.</p>
      ) : (
        <>
          <BarreFiltres pois={pois} />
          {isLoading && pois.length === 0 ? (
            <p className="text-muted-foreground">Chargement du catalogue.</p>
          ) : null}
          {isError && pois.length === 0 ? (
            <p className="text-muted-foreground">Catalogue indisponible pour l'instant (le service n'est pas branché).</p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {liste.map((p) => (
              <CartePoiCatalogue
                key={p.id}
                poi={p}
                monTier={monTierPour(p.id)}
                peutVoter={!!code}
                onVoter={(tier) => voter.mutate({ ref: `p:${p.id}`, tier: tier ?? undefined })}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
