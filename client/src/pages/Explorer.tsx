import { useEffect, useMemo, useState } from 'react';
import type { CataloguePoi } from '@barjotur/shared';
import { useCatalogue } from '@/lib/queries/catalogue';
import { filtrerCatalogue } from '@/lib/filtrer-catalogue';
import { trierCatalogue, TRIS, type TriCatalogue } from '@/lib/trier-catalogue';
import { grouperParZone, doitGrouper } from '@/lib/grouper-zone';
import { useExplorer } from '@/stores/explorer';
import { useIdentite } from '@/stores/identite';
import { useMemoireExploration } from '@/stores/memoire-exploration';
import { useOnboarding } from '@/stores/onboarding';
import { usePeut } from '@/hooks/usePeut';
import { useGrandEcran } from '@/hooks/useMediaQuery';
import { useMesVotes } from '@/lib/queries/votes';
import { BarreFiltres } from '@/components/BarreFiltres';
import { IndicateurPaniers } from '@/components/IndicateurPaniers';
import { CartePoiCatalogue } from '@/components/CartePoiCatalogue';
import { CarteMapLibre } from '@/components/CarteMapLibre';
import { Recommandations } from '@/components/Recommandations';
import { RailARevoir } from '@/components/RailARevoir';
import { ActiviteIdealeZone } from '@/components/ActiviteIdealeZone';
import { SplitScreen } from '@/ui/blocs/SplitScreen';
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
  // Tri par defaut « recommandes » (M181 §B5) : on commence par ce qui vaut le voyage, pas par 700 lignes a plat.
  const [tri, setTri] = useState<TriCatalogue>('recommandes');
  const liste = useMemo(() => trierCatalogue(filtrerCatalogue(pois, filtres), tri), [pois, filtres, tri]);

  const code = useIdentite((s) => s.code);
  const peutVoter = usePeut('voter');
  const grandEcran = useGrandEcran();
  const { data: mesVotes } = useMesVotes(code);
  const explores = useMemoireExploration((s) => s.explores);
  const nbExplores = liste.filter((p) => explores.includes(p.id)).length;

  // Astuce vote contextuelle (mini-tour T042) : montrée une fois à un voyageur identifié qui n'a pas encore
  // voté, pour rendre le geste évident. Un visiteur sans lien perso ne la voit pas (il ne peut pas voter).
  const astuceVoteVue = useOnboarding((s) => s.astuceVoteVue);
  const masquerAstuceVote = useOnboarding((s) => s.masquerAstuceVote);
  const aVote = mesVotes ? Object.keys(mesVotes.tiers).length > 0 : false;
  const montrerAstuce = peutVoter && !astuceVoteVue && !aVote;

  // Panneau liste (contenu), réutilisé tel quel sur mobile (un onglet à la fois) ET sur grand écran (à côté de
  // la carte). Extrait pour ne pas dupliquer la grille de cartes entre les deux mises en page.
  const panneauListe = (
    <div className="space-y-4">
      <BarreFiltres pois={pois} />
      {/* Tri de la liste (M181 §B5) : « Recommandés » d'abord (defaut), « A → Z » pour retrouver un lieu precis. */}
      {liste.length > 1 ? (
        <div className="flex items-center gap-2 text-sm" role="group" aria-label="Trier les lieux">
          <span className="text-muted-foreground">Trier :</span>
          <div className="inline-flex overflow-hidden rounded-md border border-border">
            {TRIS.map((t) => (
              <button
                key={t.cle}
                type="button"
                aria-pressed={tri === t.cle}
                onClick={() => setTri(t.cle)}
                className={cn(
                  'min-h-tactile px-3 py-1.5 text-sm transition-colors duration-[var(--anim-court)] ease-[var(--easing-doux)]',
                  tri === t.cle ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted',
                )}
              >
                {t.libelle}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {isLoading && pois.length === 0 ? <Chargement libelle="Chargement du catalogue." /> : null}
      {isError && pois.length === 0 ? (
        <MessageErreur>Catalogue indisponible pour l'instant (le service n'est pas branché).</MessageErreur>
      ) : null}
      {!isLoading && !isError && liste.length === 0 && pois.length > 0 ? (
        <MessageVide>Aucun lieu ne correspond à ces filtres. Élargissez la recherche.</MessageVide>
      ) : null}
      {/* Jamais de liste plate au-delà de 20 (audit) : on groupe par zone pour orienter l'œil, sinon grille simple. */}
      {doitGrouper(liste) ? (
        <div className="space-y-5">
          {grouperParZone(liste).map((g) => (
            <section key={g.zone} aria-label={g.zone} className="space-y-2">
              <h2 className="text-sm font-medium">
                {g.zone} <span className="font-normal text-muted-foreground">· {g.pois.length}</span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {g.pois.map((p) => (
                  <CartePoiCatalogue key={p.id} poi={p} explore={explores.includes(p.id)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {liste.map((p) => (
            <CartePoiCatalogue key={p.id} poi={p} explore={explores.includes(p.id)} />
          ))}
        </div>
      )}
      {/* Jauge d'exploration (M181 §B8) : repère de progression discret en pied de liste, jamais un score. Dit
          simplement combien de lieux affichés on a déjà ouverts, pour se situer sans se sentir noté (R1/R7). */}
      {liste.length > 0 ? (
        <div className="pt-1" aria-hidden={nbExplores === 0}>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={liste.length}
            aria-valuenow={nbExplores}
            aria-label="Lieux déjà parcourus"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-[var(--anim-moyen)] ease-[var(--easing-doux)]"
              style={{ width: `${Math.round((nbExplores / liste.length) * 100)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {nbExplores > 0
              ? `Vous avez parcouru ${nbExplores} des ${liste.length} lieux affichés.`
              : 'Ouvrez un lieu pour commencer votre exploration.'}
          </p>
        </div>
      ) : null}
    </div>
  );

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="font-serif text-2xl">Explorer</h1>
        <div className="flex items-center gap-2">
          {/* Notification discrète (M394) : n'apparaît que si un panier de vote déborde. */}
          <IndicateurPaniers variante="pastille" />
          <span className="text-sm text-muted-foreground">
            {liste.length} lieu{liste.length === 1 ? '' : 'x'}
            {nbExplores > 0 ? ` · ${nbExplores} déjà vu${nbExplores === 1 ? '' : 's'}` : ''}
          </span>
        </div>
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

      <div data-guide="recos">
        <Recommandations pois={pois} mesTiers={mesVotes?.tiers ?? {}} />
      </div>

      <RailARevoir pois={pois} mesTiers={mesVotes?.tiers ?? {}} />

      <ActiviteIdealeZone />

      {/* Multi-format (A26 / M112) : grand écran = liste ET carte côte à côte (deux volets) ; mobile = un onglet
          à la fois (un écran, une tâche). La carte lourde (A05) n'est montée que lorsqu'elle est visible. */}
      {grandEcran ? (
        <SplitScreen
          cleEspace="explorer"
          ratioDefaut={0.4}
          ariaLabelGauche="Liste des lieux"
          ariaLabelDroite="Carte des lieux"
          gauche={<div className="pr-1">{panneauListe}</div>}
          droite={
            <div className="pl-1">
              <CarteMapLibre mode="exploration" hauteur="calc(100dvh - 15rem)" />
            </div>
          }
        />
      ) : (
        <>
          <div role="tablist" aria-label="Mode d'exploration" data-guide="bascule-vue" className="flex gap-1 border-b border-border">
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
              <CarteMapLibre mode="exploration" />
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
