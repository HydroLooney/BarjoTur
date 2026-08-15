import { useEffect, useMemo, useState } from 'react';
import type { CataloguePoi } from '@barjotur/shared';
import { Bouton } from '@/ui/primitives/button';
import { useCatalogue } from '@/lib/queries/catalogue';
import { filtrerCatalogue } from '@/lib/filtrer-catalogue';
import { trierCatalogue, TRIS, type TriCatalogue } from '@/lib/trier-catalogue';
import { grouperParZone, doitGrouper } from '@/lib/grouper-zone';
import { useExplorer } from '@/stores/explorer';
import { useIdentite } from '@/stores/identite';
import { useMemoireExploration } from '@/stores/memoire-exploration';
import { useOnboarding } from '@/stores/onboarding';
import { usePeut } from '@/hooks/usePeut';
import { useMesVotes } from '@/lib/queries/votes';
import { BarreFiltres } from '@/components/BarreFiltres';
import { CartePoiCatalogue } from '@/components/CartePoiCatalogue';
import { CarteMapLibre } from '@/components/CarteMapLibre';
import { Recommandations } from '@/components/Recommandations';
import { QuestionnaireVoyageur } from '@/components/QuestionnaireVoyageur';
import { Chargement, MessageErreur, MessageVide } from '@/ui/blocs/EtatVue';
import { cn } from '@/lib/utils';

// Explorer (M468/M473) : LA CARTE EST LA VUE (plein écran, comme la v2). Les avancées v3 sont GARDÉES mais posées
// en OVERLAY, jamais empilées au-dessus de la carte : « La famille adore » (Recommandations) = panneau flottant
// repliable ; la liste facettée = panneau flottant ouvrable (bouton « Liste »). On découvre sur la carte ; le vote
// reste posable depuis la fiche (clic marqueur) et depuis la liste. Un seul contexte WebGL (A05).
export default function Explorer() {
  const { data, isLoading, isError } = useCatalogue();

  const [demoPois, setDemoPois] = useState<CataloguePoi[] | null>(null);
  useEffect(() => {
    const demo = import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo');
    if (demo && !data) void import('@/lib/fixtures/catalogue-demo').then((m) => setDemoPois(m.catalogueDemo));
  }, [data]);

  const pois = data ?? demoPois ?? [];
  const filtres = useExplorer((s) => s.filtres);
  const [tri, setTri] = useState<TriCatalogue>('recommandes');
  const liste = useMemo(() => trierCatalogue(filtrerCatalogue(pois, filtres), tri), [pois, filtres, tri]);

  const code = useIdentite((s) => s.code);
  const peutVoter = usePeut('voter');
  const { data: mesVotes } = useMesVotes(code);
  const explores = useMemoireExploration((s) => s.explores);

  // Overlays repliables (la carte reste la vedette). Le questionnaire (M486) est REJOUABLE en overlay d'ici.
  const [recosOuvertes, setRecosOuvertes] = useState(false);
  const [listeOuverte, setListeOuverte] = useState(false);
  const [questionnaireOuvert, setQuestionnaireOuvert] = useState(false);

  const astuceVoteVue = useOnboarding((s) => s.astuceVoteVue);
  const masquerAstuceVote = useOnboarding((s) => s.masquerAstuceVote);
  const aVote = mesVotes ? Object.keys(mesVotes.tiers).length > 0 : false;
  const montrerAstuce = peutVoter && !astuceVoteVue && !aVote;

  const panneauListe = (
    <div className="space-y-4">
      <BarreFiltres pois={pois} />
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
                  'min-h-tactile px-3 py-1.5 text-sm transition-colors',
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
      {doitGrouper(liste) ? (
        <div className="space-y-5">
          {grouperParZone(liste).map((g) => (
            <section key={g.zone} aria-label={g.zone} className="space-y-2">
              <h2 className="text-sm font-medium">
                {g.zone} <span className="font-normal text-muted-foreground">· {g.pois.length}</span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {g.pois.map((p) => (
                  <CartePoiCatalogue key={p.id} poi={p} explore={explores.includes(p.id)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {liste.map((p) => (
            <CartePoiCatalogue key={p.id} poi={p} explore={explores.includes(p.id)} />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <section className="-mx-4 -mt-4 flex h-[calc(100dvh-8.5rem)] flex-col md:h-[calc(100dvh-6.5rem)]">
      {/* BARRE D'ACTIONS (M485) : boutons COURTS en haut, DISTINCTS des panneaux de données (qui restent en overlay
          sur la carte). Action = barre haute ; données (recos, liste) = overlay. La carte reste la vue. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2">
        {/* Le questionnaire de voyage, REJOUABLE en overlay d'ici (M486) : gros, guidé, écrit le même profil que
            les sliders de Voter. « Commencer ici » = régler sa façon de voyager. */}
        <Bouton size="sm" onClick={() => setQuestionnaireOuvert(true)}>
          Commencer ici
        </Bouton>
        <Bouton size="sm" variant="outline" onClick={() => setQuestionnaireOuvert(true)}>
          Philosophie du voyage
        </Bouton>
        <Bouton size="sm" variant="outline" onClick={() => setRecosOuvertes(true)}>
          ❤ La famille adore
        </Bouton>
        <Bouton size="sm" variant="outline" onClick={() => setListeOuverte(true)}>
          Voir la liste <span className="chiffres">{liste.length}</span>
        </Bouton>
      </div>

      <div className="relative flex-1">
        {/* LA CARTE, plein cadre. POI, clic → fiche, vote, découpage, sentiers : tout est déjà dedans (v3). */}
        <CarteMapLibre mode="exploration" hauteur="100%" />

        {/* Panneau de DONNÉES « La famille adore » (Recommandations) — OVERLAY flottant, ouvert par « Commencer ici ». */}
        {recosOuvertes ? (
          <div className="absolute inset-x-2 top-2 z-10 max-h-[60vh] overflow-y-auto rounded-lg border border-border bg-card/97 p-3 shadow-flottante backdrop-blur-sm sm:inset-x-auto sm:left-2 sm:max-w-sm">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-medium">❤ La famille adore</h2>
              <button
                type="button"
                onClick={() => setRecosOuvertes(false)}
                className="min-h-tactile px-2 text-muted-foreground hover:text-foreground"
                aria-label="Fermer"
              >
                ×
              </button>
            </div>
            <Recommandations pois={pois} mesTiers={mesVotes?.tiers ?? {}} />
          </div>
        ) : null}

      {listeOuverte ? (
        <div className="absolute inset-0 z-20 flex" role="dialog" aria-modal="true" aria-label="Liste des lieux">
          <button type="button" aria-label="Fermer" className="flex-1 bg-granite/30" onClick={() => setListeOuverte(false)} />
          <div className="h-full w-full overflow-y-auto border-l border-border bg-card p-4 shadow-flottante sm:w-[26rem]">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-serif text-lg">Les lieux</h2>
              <button
                type="button"
                onClick={() => setListeOuverte(false)}
                className="min-h-tactile px-2 text-lg text-muted-foreground hover:text-foreground"
                aria-label="Fermer la liste"
              >
                ×
              </button>
            </div>
            {panneauListe}
          </div>
        </div>
      ) : null}

      {/* Astuce vote (onboarding v3 gardé) — toast bas, non bloquant. */}
      {montrerAstuce ? (
        <div
          role="status"
          className="absolute inset-x-2 bottom-2 z-10 flex items-start justify-between gap-2 rounded-lg border border-primary bg-card/97 p-3 text-sm shadow-flottante backdrop-blur-sm sm:inset-x-auto sm:left-1/2 sm:max-w-md sm:-translate-x-1/2"
        >
          <p className="max-w-prose text-muted-foreground">
            Astuce : ouvrez un lieu et dites ce que vous aimez (coup de cœur, vraiment envie, bien, pourquoi
            pas). C'est votre vote, changeable quand vous voulez.
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
      </div>

      {/* Questionnaire de voyage REJOUABLE en overlay (M486) — le mode guidé, même profil que les sliders de Voter. */}
      {questionnaireOuvert ? <QuestionnaireVoyageur onClose={() => setQuestionnaireOuvert(false)} /> : null}
    </section>
  );
}
