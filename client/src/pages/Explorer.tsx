import { useEffect, useMemo, useState } from 'react';
import type { CataloguePoi, VoteTier } from '@barjotur/shared';
import { useCatalogue } from '@/lib/queries/catalogue';
import { filtrerCatalogue } from '@/lib/filtrer-catalogue';
import { useExplorer } from '@/stores/explorer';
import { useIdentite } from '@/stores/identite';
import { useMemoireExploration } from '@/stores/memoire-exploration';
import { useOnboarding } from '@/stores/onboarding';
import { usePeut } from '@/hooks/usePeut';
import { useGrandEcran } from '@/hooks/useMediaQuery';
import { useMesVotes, useVoteUnitaire } from '@/lib/queries/votes';
import { BarreFiltres } from '@/components/BarreFiltres';
import { CartePoiCatalogue } from '@/components/CartePoiCatalogue';
import { CarteExplorer } from '@/components/CarteExplorer';
import { Recommandations } from '@/components/Recommandations';
import { ActiviteIdealeZone } from '@/components/ActiviteIdealeZone';
import { Chargement, MessageErreur, MessageVide } from '@/ui/blocs/EtatVue';
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
  const peutVoter = usePeut('voter');
  const grandEcran = useGrandEcran();
  const { data: mesVotes } = useMesVotes(code);
  const voter = useVoteUnitaire(code);
  const explores = useMemoireExploration((s) => s.explores);
  const nbExplores = liste.filter((p) => explores.includes(p.id)).length;

  // Astuce vote contextuelle (mini-tour T042) : montrée une fois à un voyageur identifié qui n'a pas encore
  // voté, pour rendre le geste évident. Un visiteur sans lien perso ne la voit pas (il ne peut pas voter).
  const astuceVoteVue = useOnboarding((s) => s.astuceVoteVue);
  const masquerAstuceVote = useOnboarding((s) => s.masquerAstuceVote);
  const aVote = mesVotes ? Object.keys(mesVotes.tiers).length > 0 : false;
  const montrerAstuce = peutVoter && !astuceVoteVue && !aVote;

  const monTierPour = (osmId: string): VoteTier | null => {
    const v = mesVotes?.tiers[`p:${osmId}`];
    return v ?? null;
  };

  // Panneau liste (contenu), réutilisé tel quel sur mobile (un onglet à la fois) ET sur grand écran (à côté de
  // la carte). Extrait pour ne pas dupliquer la grille de cartes entre les deux mises en page.
  const panneauListe = (
    <div className="space-y-4">
      <BarreFiltres pois={pois} />
      {isLoading && pois.length === 0 ? <Chargement libelle="Chargement du catalogue." /> : null}
      {isError && pois.length === 0 ? (
        <MessageErreur>Catalogue indisponible pour l'instant (le service n'est pas branché).</MessageErreur>
      ) : null}
      {!isLoading && !isError && liste.length === 0 && pois.length > 0 ? (
        <MessageVide>Aucun lieu ne correspond à ces filtres. Élargissez la recherche.</MessageVide>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {liste.map((p) => (
          <CartePoiCatalogue
            key={p.id}
            poi={p}
            monTier={monTierPour(p.id)}
            peutVoter={peutVoter}
            explore={explores.includes(p.id)}
            onVoter={(tier) => voter.mutate({ ref: `p:${p.id}`, tier: tier ?? undefined })}
          />
        ))}
      </div>
    </div>
  );

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="font-serif text-2xl">Explorer</h1>
        <span className="text-sm text-muted-foreground">
          {liste.length} lieu{liste.length === 1 ? '' : 'x'}
          {nbExplores > 0 ? ` · ${nbExplores} déjà vu${nbExplores === 1 ? '' : 's'}` : ''}
        </span>
      </div>

      {montrerAstuce ? (
        <div
          role="status"
          className="flex items-start justify-between gap-2 rounded-lg border border-primary bg-card p-3 text-sm"
        >
          <p className="max-w-prose text-muted-foreground">
            Astuce : sur chaque lieu, un bouton dit ce que vous aimez (coup de cœur, vraiment envie, bien, pourquoi
            pas). C'est votre vote, et vous pouvez le changer quand vous voulez.
          </p>
          <button
            type="button"
            onClick={masquerAstuceVote}
            className="flex min-h-tactile shrink-0 items-center px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Compris
          </button>
        </div>
      ) : null}

      <Recommandations pois={pois} mesTiers={mesVotes?.tiers ?? {}} />

      <ActiviteIdealeZone />

      {/* Multi-format (A26 / M112) : grand écran = liste ET carte côte à côte (deux volets) ; mobile = un onglet
          à la fois (un écran, une tâche). La carte lourde (A05) n'est montée que lorsqu'elle est visible. */}
      {grandEcran ? (
        <div className="grid grid-cols-2 gap-4">
          <div aria-label="Liste des lieux">{panneauListe}</div>
          <div aria-label="Carte des lieux">
            <CarteExplorer hauteur="calc(100dvh - 15rem)" />
          </div>
        </div>
      ) : (
        <>
          <div role="tablist" aria-label="Mode d'exploration" className="flex gap-1 border-b border-border">
            {ONGLETS.map((o, i) => (
              <button
                key={o.cle}
                type="button"
                role="tab"
                id={`onglet-${o.cle}`}
                aria-selected={onglet === o.cle}
                aria-controls={`panneau-${o.cle}`}
                // Pattern ARIA tabs : roving tabindex (seul l'onglet actif est tabbable) + flèches gauche/droite.
                tabIndex={onglet === o.cle ? 0 : -1}
                onKeyDown={(e) => {
                  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                  e.preventDefault();
                  const dir = e.key === 'ArrowRight' ? 1 : -1;
                  const cible = ONGLETS[(i + dir + ONGLETS.length) % ONGLETS.length];
                  if (!cible) return;
                  setOnglet(cible.cle);
                  document.getElementById(`onglet-${cible.cle}`)?.focus();
                }}
                onClick={() => setOnglet(o.cle)}
                className={cn(
                  'inline-flex min-h-tactile items-center px-3 py-2 text-sm transition-colors',
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
            <div role="tabpanel" id="panneau-carte" aria-labelledby="onglet-carte">
              <CarteExplorer />
            </div>
          ) : (
            <div role="tabpanel" id="panneau-liste" aria-labelledby="onglet-liste">
              {panneauListe}
            </div>
          )}
        </>
      )}
    </section>
  );
}
