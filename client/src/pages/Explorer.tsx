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
import { useRecos } from '@/lib/queries/recos';
import { RECOS_TEST } from '@/lib/fixtures/recos-test';
import { BarreFiltres } from '@/components/BarreFiltres';
import { CartePoiCatalogue } from '@/components/CartePoiCatalogue';
import { CarteMapLibre, type CibleCamera } from '@/components/CarteMapLibre';
import { Recommandations } from '@/components/Recommandations';
import { QuestionnaireVoyageur } from '@/components/QuestionnaireVoyageur';
import { FichePOI } from '@/components/FichePOI';
import { poiDeReco } from '@/lib/adapt-poi-geojson';
import type { BBox } from '@/lib/queries/poi-bbox';
import { humaniserTexte } from '@/lib/libelles';
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

  // Recos personnalisées (recos_voyageur) pour le panneau JUMEAU « Vos recommandations » (M505). Jeu de test DEV.
  const recosReel = useRecos(code).data?.recos ?? [];
  const vosRecos = (recosReel.length ? recosReel : import.meta.env.DEV ? RECOS_TEST : []).slice(0, 6);

  // Panneaux flottants sur la carte (M505 : la carte reste centrale, panneaux NON bloquants, un lourd à la fois).
  const [recosOuvertes, setRecosOuvertes] = useState(false);
  const [vosRecosOuvertes, setVosRecosOuvertes] = useState(false);
  const [listeOuverte, setListeOuverte] = useState(false);
  const [questionnaireOuvert, setQuestionnaireOuvert] = useState(false);

  // Caméra + emprise (M505/M511) : la liste se pilote par la VUE (bbox), et cliquer un lieu depuis un panneau
  // RECENTRE la carte + ouvre la fiche EN OVERLAY (on ne quitte pas la carte).
  const [bbox, setBbox] = useState<BBox | null>(null);
  const [centrer, setCentrer] = useState<CibleCamera | null>(null);
  const [fichePage, setFichePage] = useState<CataloguePoi | null>(null);
  const dansVue = (p: CataloguePoi): boolean =>
    !bbox || (p.lon >= bbox.minlon && p.lon <= bbox.maxlon && p.lat >= bbox.minlat && p.lat <= bbox.maxlat);
  const listeVue = useMemo(() => liste.filter(dansVue), [liste, bbox]);
  const ouvrirLieu = (poi: CataloguePoi) => {
    setCentrer({ lon: poi.lon, lat: poi.lat, zoom: 12 });
    setFichePage(poi);
  };

  const astuceVoteVue = useOnboarding((s) => s.astuceVoteVue);
  const masquerAstuceVote = useOnboarding((s) => s.masquerAstuceVote);
  const aVote = mesVotes ? Object.keys(mesVotes.tiers).length > 0 : false;
  const montrerAstuce = peutVoter && !astuceVoteVue && !aVote;

  const panneauListe = (
    <div className="space-y-4">
      {/* La liste reflète l'EMPRISE de la carte (M505 §2b) : les lieux dans la vue, cohérent « N dans la vue ». */}
      <p className="text-xs text-muted-foreground">
        <span className="chiffres text-foreground">{listeVue.length}</span> lieu{listeVue.length === 1 ? '' : 'x'} dans la vue
        {bbox ? ' · dézoomez pour en voir plus' : ''}
      </p>
      <BarreFiltres pois={pois} />
      {listeVue.length > 1 ? (
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
      {!isLoading && !isError && listeVue.length === 0 && pois.length > 0 ? (
        <MessageVide>Aucun lieu dans la vue. Déplacez ou dézoomez la carte, ou élargissez les filtres.</MessageVide>
      ) : null}
      {doitGrouper(listeVue) ? (
        <div className="space-y-5">
          {grouperParZone(listeVue).map((g) => (
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
          {listeVue.map((p) => (
            <CartePoiCatalogue key={p.id} poi={p} explore={explores.includes(p.id)} />
          ))}
        </div>
      )}
    </div>
  );

  // Un seul panneau lourd à la fois (M505 §5, zéro chevauchement) : ouvrir l'un ferme les autres.
  const ouvrir = (quoi: 'recos' | 'vosRecos' | 'liste' | null) => {
    setRecosOuvertes(quoi === 'recos');
    setVosRecosOuvertes(quoi === 'vosRecos');
    setListeOuverte(quoi === 'liste');
  };
  const chipFlottant =
    'pointer-events-auto inline-flex min-h-tactile items-center gap-1.5 rounded-full border border-border bg-card/90 px-3 py-1.5 text-sm font-medium shadow-flottante backdrop-blur-sm transition-colors hover:bg-card';

  return (
    // CARTE PLEINE LARGEUR de fenêtre (full-bleed, M505) : on sort du conteneur centré ; les contrôles FLOTTENT
    // par-dessus (fini les gouttières beige). La carte reste centrale ; les panneaux ne la bloquent pas.
    <section className="relative -mt-4 h-[calc(100dvh-8.5rem)] w-screen left-1/2 -translate-x-1/2 overflow-hidden md:h-[calc(100dvh-6.5rem)]">
      <CarteMapLibre mode="exploration" hauteur="100%" centrer={centrer} onBbox={setBbox} />

      {/* Contrôles FLOTTANTS translucides au-dessus de la carte (M505 §1). Action = « Commencer ici » (questionnaire) ;
          panneaux de données = La famille adore / Vos recommandations / Liste (un lourd à la fois). */}
      <div className="pointer-events-none absolute inset-x-0 top-2 z-20 flex flex-wrap items-center gap-2 px-3">
        <Bouton size="sm" className="pointer-events-auto shadow-flottante" onClick={() => setQuestionnaireOuvert(true)}>
          Commencer ici
        </Bouton>
        <button type="button" className={chipFlottant} aria-pressed={recosOuvertes} onClick={() => ouvrir(recosOuvertes ? null : 'recos')}>
          ❤ La famille adore
        </button>
        <button type="button" className={chipFlottant} aria-pressed={vosRecosOuvertes} onClick={() => ouvrir(vosRecosOuvertes ? null : 'vosRecos')}>
          ✦ Vos recommandations
        </button>
        <button type="button" className={chipFlottant} aria-pressed={listeOuverte} onClick={() => ouvrir(listeOuverte ? null : 'liste')}>
          ☰ Liste <span className="chiffres text-muted-foreground">{listeVue.length}</span>
        </button>
      </div>

      {/* Panneau « La famille adore » (Recommandations, catalogue) — flottant translucide, haut-gauche. */}
      {recosOuvertes ? (
        <div className="absolute inset-x-2 top-16 z-10 max-h-[62vh] overflow-y-auto rounded-lg border border-border bg-card/95 p-3 shadow-flottante backdrop-blur-sm sm:inset-x-auto sm:left-3 sm:max-w-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium">❤ La famille adore</h2>
            <button type="button" onClick={() => ouvrir(null)} className="min-h-tactile px-2 text-muted-foreground hover:text-foreground" aria-label="Fermer">×</button>
          </div>
          <Recommandations pois={pois} mesTiers={mesVotes?.tiers ?? {}} onSelect={ouvrirLieu} />
        </div>
      ) : null}

      {/* Panneau JUMEAU « Vos recommandations » (recos_voyageur personnalisées, M505 §4) — même pattern. */}
      {vosRecosOuvertes ? (
        <div className="absolute inset-x-2 top-16 z-10 max-h-[62vh] overflow-y-auto rounded-lg border border-border bg-card/95 p-3 shadow-flottante backdrop-blur-sm sm:inset-x-auto sm:left-3 sm:max-w-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium">✦ Vos recommandations</h2>
            <button type="button" onClick={() => ouvrir(null)} className="min-h-tactile px-2 text-muted-foreground hover:text-foreground" aria-label="Fermer">×</button>
          </div>
          {vosRecos.length > 0 ? (
            <ul className="space-y-1">
              {vosRecos.map((r) => (
                <li key={r.cle}>
                  {/* Clic = OVERLAY fiche + ZOOM sur la carte, on NE QUITTE PAS la carte (M505 §3). */}
                  <button
                    type="button"
                    onClick={() => ouvrirLieu(pois.find((p) => p.id === r.cle) ?? poiDeReco(r))}
                    className="flex w-full items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    <span aria-hidden className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: 'var(--accent)' }} />
                    {humaniserTexte(r.nom)}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Vos recommandations personnalisées apparaîtront ici.</p>
          )}
        </div>
      ) : null}

      {/* Liste NON-BLOQUANTE (M505 §2) : drawer translucide (desktop ~40 % à droite, mobile bottom-sheet borné) —
          la carte reste VISIBLE et centrale, pas d'overlay opaque plein écran. */}
      {listeOuverte ? (
        <div
          className="absolute inset-x-0 bottom-0 z-10 max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-border bg-card/95 p-4 shadow-flottante backdrop-blur-sm sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-2/5 sm:min-w-[22rem] sm:max-w-md sm:rounded-none sm:border-l sm:border-t-0"
          role="dialog"
          aria-label="Liste des lieux"
        >
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-serif text-lg">Les lieux</h2>
            <button type="button" onClick={() => ouvrir(null)} className="min-h-tactile px-2 text-lg text-muted-foreground hover:text-foreground" aria-label="Fermer la liste">×</button>
          </div>
          {panneauListe}
        </div>
      ) : null}

      {/* Astuce vote (onboarding v3 gardé) — toast bas, non bloquant. */}
      {montrerAstuce ? (
        <div
          role="status"
          className="absolute inset-x-2 bottom-2 z-10 flex items-start justify-between gap-2 rounded-lg border border-primary bg-card/95 p-3 text-sm shadow-flottante backdrop-blur-sm sm:inset-x-auto sm:left-1/2 sm:max-w-md sm:-translate-x-1/2"
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

      {/* Fiche en OVERLAY au-dessus de la carte (M505 §3) : ouverte au clic d'un lieu depuis un panneau (recos), la
          carte ayant recentré/zoomé dessus. On NE quitte PAS la carte. Colonne à droite (desktop) / bas (mobile). */}
      {fichePage ? (
        <div className="absolute inset-x-2 bottom-2 z-30 flex max-h-[80%] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-flottante sm:inset-y-2 sm:left-auto sm:right-2 sm:max-h-none sm:w-[24rem]">
          <div className="flex items-center justify-between gap-2 border-b border-border px-2 py-1.5">
            <span className="truncate text-sm font-medium">{humaniserTexte(fichePage.nom)}</span>
            <button type="button" onClick={() => setFichePage(null)} className="min-h-tactile px-2 text-lg text-muted-foreground hover:text-foreground" aria-label="Fermer la fiche">×</button>
          </div>
          <div className="overflow-y-auto p-3">
            <FichePOI poi={fichePage} mode="popover" />
          </div>
        </div>
      ) : null}

      {/* Questionnaire de voyage REJOUABLE en overlay (M486) — le mode guidé, même profil que les sliders de Voter. */}
      {questionnaireOuvert ? <QuestionnaireVoyageur onClose={() => setQuestionnaireOuvert(false)} /> : null}
    </section>
  );
}
