import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useMemo, useState } from 'react';
import { Source, Layer } from '@vis.gl/react-maplibre';
import type { FeatureCollection } from 'geojson';
import type { CataloguePoi } from '@barjotur/shared';
import { poiDeGeojson, poiDeReco } from '@/lib/adapt-poi-geojson';
import { useRecos } from '@/lib/queries/recos';
import { RECOS_TEST } from '@/lib/fixtures/recos-test';
import { CoucheRecos } from '@/components/CoucheRecos';
import { useIdentite } from '@/stores/identite';
import { useBboxPois, type BBox } from '@/lib/queries/poi-bbox';
import { useCatalogue } from '@/lib/queries/catalogue';
import { BoutonVote } from '@/ui/blocs/BoutonVote';
import { FichePOI } from '@/components/FichePOI';
import { charte } from '@/ui/theme';
import { CadreCarte } from '@/components/CadreCarte';
import { useUi } from '@/stores/ui';
import { DIFFICULTES, SENTIERS_MINZOOM, layerIdSentier, libelleDifficulte } from '@/lib/sentiers';
import { useDecoupageData, couleurRegionExpr } from '@/lib/decoupage';
import { useCartoData, martinTuiles, martinSourceLayer } from '@/lib/carto-source';
import { CATEGORIES } from '@/lib/categories-poi';
import { libelleCategorie } from '@/lib/libelles';
import { PanneauCategories } from '@/components/PanneauCategories';
import { MarqueursCategories } from '@/components/MarqueursCategories';

// Casts d'expression MapLibre → type de sortie par entité (heurt de versions du style-spec ; évalué au runtime).
const exprNum = (e: unknown): number => e as unknown as number;
const exprStr = (e: unknown): string => e as unknown as string;

function fcDe(features: import('geojson').Feature[]): FeatureCollection {
  return { type: 'FeatureCollection', features };
}

// Carte Explorer (C15 / A05) : TOUS les POI de l'emprise visible, en deux couches DISTINCTES (votables
// = pastille ocre ; repères non-votables = petit point granite discret, A13). Anti-cadrage : aucune
// couleur de score portée sur la carte. Cliquer un POI ouvre un panneau où le vote est reposable
// (via le BoutonVote centralisé, geste identique à la tuile et à la fiche). Un seul contexte WebGL,
// couleurs par jetons (zéro hex, darkmode-aware).

const VUE_INITIALE = { longitude: 8, latitude: 61, zoom: 4.2 };
const LAYER_VOTABLE = 'poi-votable';
const LAYER_REPERE = 'poi-repere';
const VIDE: FeatureCollection = { type: 'FeatureCollection', features: [] };

interface LngLatBornes {
  getWest(): number;
  getSouth(): number;
  getEast(): number;
  getNorth(): number;
}

interface PoiClique {
  osmId: string;
  nom: string;
  categorie: string | null;
  tierDefaut: string | null;
  votable: boolean;
}

export function CarteExplorer({ hauteur = '70vh' }: { hauteur?: string }) {
  const theme = useUi((s) => s.theme);
  const [bbox, setBbox] = useState<BBox | null>(null);
  const { data: fc } = useBboxPois(bbox);
  const [clique, setClique] = useState<PoiClique | null>(null);
  const [sentier, setSentier] = useState<{ nom: string; difficulte: string } | null>(null);
  const [legendeOuverte, setLegendeOuverte] = useState(false); // C17 : légende sentiers repliée par défaut
  const [fichePoi, setFichePoi] = useState<CataloguePoi | null>(null); // M375 §3 : fiche ouverte au clic marqueur (adapteur geojson)
  const [ficheRepliee, setFicheRepliee] = useState(false); // M409 : overlay fiche repliable
  const { data: catalogue } = useCatalogue();
  // Recos personnalisées du voyageur ACTIF (M379/M426) : couche animée hors-clustering, clic → sous-zone → fiche.
  const codeVoyageur = useIdentite((s) => s.code);
  const recosReel = useRecos(codeVoyageur).data?.recos ?? [];
  // JEU DE TEST DEV (R1, non réel) tant que l'endpoint rend [] : pour cribler l'animation + le flux (M427). Jamais en prod.
  const recos = recosReel.length ? recosReel : import.meta.env.DEV ? RECOS_TEST : [];

  // Fixture de DEV (chargée dynamiquement, absente de la prod) : marqueurs POI sans BFF pour la vérif visuelle
  // de la carte (`?demo`), comme la liste. Points depuis lon/lat des POI de démo, mêmes properties que le bbox.
  const [demoFc, setDemoFc] = useState<FeatureCollection | null>(null);
  useEffect(() => {
    const demo = import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo');
    if (!demo || fc) return;
    void import('@/lib/fixtures/catalogue-demo').then((m) => {
      setDemoFc({
        type: 'FeatureCollection',
        features: m.catalogueDemo.map((p) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
          properties: {
            osm_id: p.id,
            nom: p.nom,
            categorie: p.categorie,
            tier_defaut: p.tier_defaut,
            votable: p.votable,
          },
        })),
      });
    });
  }, [fc]);

  const couleurs = useMemo(
    () => ({ votable: charte('--ocre'), repere: charte('--granite'), bord: charte('--papier'), circuit: charte('--accent') }),
    [theme],
  );
  // Une couleur résolue (dark-safe) par niveau de difficulté DNT (T048). Recalcul au changement de thème.
  const difficultes = useMemo(() => DIFFICULTES.map((d) => ({ ...d, couleur: charte(d.token) })), [theme]);

  // Découpage EN CONTEXTE (étape 2) : le même découpage réel que la coulisses (symbologie partagée, lib/decoupage),
  // mais posé en fond DISCRET sous les POI, ZOOM-ADAPTATIF (régions en vue d'ensemble → s'effacent quand on zoome
  // sur les lieux, doctrine « une carte = une question » : ici la question ce sont les POI, la région n'est qu'un
  // repère). Régions + zones seulement (pas les sous-zones : trop granulaire sous un semis de POI).
  const decoupage = useDecoupageData();
  const couleurRegion = useMemo(() => couleurRegionExpr(decoupage.regions), [decoupage.regions, theme]);

  // Calques POI par CATÉGORIE (étape 3) : les POI réels (v_web_poi v3 en export statique, M364/M365) colorés par FAMILLE,
  // filtrables par catégorie (panneau). Le dump v3 porte NATIVEMENT `categorie_calque` (18 buckets), `tier` (5 crans réels
  // T/S/A/B/C), `confiance`, `votable`, `sous_zone_id` → plus de dérivation `SOURCE_VERS_BUCKET` ni de simulation de tier.
  // Couleur/icône = contrat unique `lib/categories-poi` (même que légende/filtre/fiche/survol).
  const poiCat = useCartoData('poi').data ?? null;
  // Sentiers : en prod = TUILES Martin (139k lignes) ; en statique = GeoJSON. On ne charge le GeoJSON QUE hors tuiles.
  const sentiersTuiles = martinTuiles('sentiers');
  const sentiers = useCartoData('sentiers', !sentiersTuiles);
  const circuits = useCartoData('circuits'); // `v_web_circuits` en LIGNE (LineString, B123) ; vide en dev jusqu'au dump final
  const [catActives, setCatActives] = useState<Set<string>>(() => new Set(CATEGORIES.map((c) => c.cle)));
  // C17 : la carte n'affiche QUE les POI votables par défaut (le sous-ensemble scoré 486/778, champ `votable` d'A),
  // pour désencombrer. Décocher révèle les repères/services non votables. On se branche sur le booléen (M327).
  const [votablesOnly, setVotablesOnly] = useState(true);
  function basculeCat(cle: string) {
    setCatActives((s) => {
      const n = new Set(s);
      if (n.has(cle)) n.delete(cle);
      else n.add(cle);
      return n;
    });
  }
  function toutCat(tout: boolean) {
    setCatActives(tout ? new Set(CATEGORIES.map((c) => c.cle)) : new Set());
  }
  // C17 : bascule d'une FAMILLE entière (groupe) — toutes ses catégories on/off d'un geste (toggles hiérarchiques).
  function basculeFamille(cles: string[], tout: boolean) {
    setCatActives((s) => {
      const n = new Set(s);
      for (const c of cles) if (tout) n.add(c);
      else n.delete(c);
      return n;
    });
  }
  const couleursDec = useMemo(
    () => ({ zone: charte('--granite'), label: charte('--carte-etiquette'), labelHalo: charte('--carte-etiquette-halo') }),
    [theme],
  );

  const donnees = fc ?? demoFc ?? VIDE;

  // Interface structurelle minimale : évite le conflit de types `Map` entre maplibre-gl (client) et le
  // bundle maplibre embarqué par @vis.gl/react-maplibre (mêmes membres, types nominalement distincts).
  function majBounds(map: { getBounds: () => LngLatBornes }): void {
    const b = map.getBounds();
    setBbox({ minlon: b.getWest(), minlat: b.getSouth(), maxlon: b.getEast(), maxlat: b.getNorth() });
  }

  // Légende des sentiers par difficulté (T048), coin haut-droit, REPLIÉE PAR DÉFAUT (C17) : les sentiers eux-mêmes
  // n'apparaissent qu'au zoom, la légende n'a donc pas à occuper l'écran d'entrée. Repliée = petite puce « Sentiers » ;
  // dépliée = le nuancier des difficultés (même geste que le panneau Catégories, cohérence M239).
  const legende = !legendeOuverte ? (
    <button
      type="button"
      onClick={() => setLegendeOuverte(true)}
      className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-lg border border-border bg-card/95 px-2.5 py-1 text-micro font-medium text-muted-foreground shadow-posee backdrop-blur-sm transition-colors duration-court hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span aria-hidden>≈</span> Sentiers
    </button>
  ) : (
    <div className="absolute right-2 top-2 z-10 flex flex-col gap-0.5 rounded-lg border border-border bg-card p-2 text-xs shadow-flottante">
      <button
        type="button"
        onClick={() => setLegendeOuverte(false)}
        aria-label="Replier la légende des sentiers"
        className="mb-0.5 flex items-center justify-between gap-2 font-medium text-muted-foreground hover:text-foreground"
      >
        Sentiers <span aria-hidden>▴</span>
      </button>
      {difficultes.map((d) => (
        <span key={d.code} className="flex items-center gap-1.5 text-muted-foreground">
          <span className="inline-block h-1.5 w-4 rounded-sm" style={{ backgroundColor: d.couleur }} aria-hidden />
          {d.libelle}
        </span>
      ))}
    </div>
  );

  // POI cliqué résolu dans le catalogue scoré (pour la fiche popover complète) ; null si hors catalogue → repli.
  const poiClique = clique ? (catalogue?.find((p) => p.id === clique.osmId) ?? null) : null;

  const panneau = sentier ? (
    <div className="absolute inset-x-2 bottom-2 rounded-lg border border-border bg-card p-3 shadow-charte">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-serif text-base">{sentier.nom}</p>
          <p className="text-xs text-muted-foreground">Sentier · {libelleDifficulte(sentier.difficulte)}</p>
        </div>
        <button
          type="button"
          className="min-h-tactile px-2 text-lg text-muted-foreground hover:text-foreground"
          onClick={() => setSentier(null)}
          aria-label="Fermer"
        >
          ×
        </button>
      </div>
    </div>
  ) : clique ? (
    <div className="absolute inset-x-2 bottom-2 max-h-[62%] overflow-y-auto rounded-lg border border-border bg-card p-3 shadow-charte">
      <div className="flex justify-end">
        <button
          type="button"
          className="min-h-tactile px-2 text-lg text-muted-foreground hover:text-foreground"
          onClick={() => setClique(null)}
          aria-label="Fermer"
        >
          ×
        </button>
      </div>
      {poiClique ? (
        // Fiche PARTAGÉE en mode popover (design-system) : geste de vote et contenu identiques à la fiche pleine,
        // sans quitter la carte. Pas de 2e carte WebGL (A05) : le tracé reste sur la carte derrière.
        <FichePOI poi={poiClique} mode="popover" />
      ) : (
        // Repli minimal si le POI cliqué n'est pas dans le catalogue scoré (emprise plus large que le catalogue).
        <div className="space-y-2">
          <p className="font-serif text-base">{clique.nom}</p>
          {libelleCategorie(clique.categorie) ? <p className="text-xs text-muted-foreground">{libelleCategorie(clique.categorie)}</p> : null}
          {clique.votable ? (
            <BoutonVote cible={`p:${clique.osmId}`} tierDefaut={clique.tierDefaut} />
          ) : (
            <span className="text-xs text-muted-foreground">Repère non votable.</span>
          )}
        </div>
      )}
    </div>
  ) : (
    // Repère de contexte : pastille CENTRÉE et compacte (M328), plus la barre pleine largeur qui télescopait avec le
    // bouton Catégories (haut-gauche) et les toponymes de zone. Un gutter net de chaque côté pour les labels carto.
    <div className="pointer-events-none absolute left-1/2 top-2 max-w-[70%] -translate-x-1/2 truncate rounded-full border border-border bg-card/85 px-3 py-1 text-center text-xs text-muted-foreground shadow-posee backdrop-blur-sm">
      {donnees.features.length} lieux dans la vue. Zoomez pour voir les sentiers.
    </div>
  );

  const surimpression = (
    <>
      {legende}
      {panneau}
      <PanneauCategories
        actifs={catActives}
        onBascule={basculeCat}
        onTout={toutCat}
        onBasculeFamille={basculeFamille}
        votablesOnly={votablesOnly}
        onVotablesOnly={setVotablesOnly}
      />
      {/* Fiche en OVERLAY au clic sur un marqueur (M375 §3) : ouverture immédiate (adapteur geojson) ; le détail + les
          photos arrivent en lazy (usePoiFiche). Panneau bas scrollable, fermeture propre, retour à la carte. */}
      {fichePoi ? (
        // M409 + M422 : overlay fiche REPLIABLE (en-tête cliquable → réduit à la barre de titre) + REDIMENSIONNABLE en
        // largeur sur desktop (`sm:resize-x`, poignée native), colonne de lecture MOINS LARGE (mobile plein, desktop
        // ~23rem à droite). Ascenseur visible dès que le contenu déborde. Charte via tokens.
        <div className="absolute inset-x-2 bottom-2 z-20 flex max-h-[80%] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-flottante sm:left-auto sm:right-2 sm:w-[23rem] sm:min-w-[16rem] sm:max-w-[38rem] sm:resize-x">
          {/* En-tête : replier / titre / fermer. Sticky en tête de la colonne. */}
          <div className="flex items-center justify-between gap-2 border-b border-border bg-card px-2 py-1.5">
            <button
              type="button"
              onClick={() => setFicheRepliee((r) => !r)}
              aria-expanded={!ficheRepliee}
              className="flex min-h-tactile flex-1 items-center gap-1.5 truncate text-left text-sm font-medium text-foreground hover:text-accent"
            >
              <span aria-hidden className="text-xs text-muted-foreground">{ficheRepliee ? '▸' : '▾'}</span>
              <span className="truncate">{fichePoi.nom}</span>
            </button>
            <button
              type="button"
              className="min-h-tactile px-2 text-lg text-muted-foreground hover:text-foreground"
              onClick={() => setFichePoi(null)}
              aria-label="Fermer la fiche"
            >
              ×
            </button>
          </div>
          {!ficheRepliee ? (
            <div className="overflow-y-auto p-3">
              <FichePOI poi={fichePoi} mode="popover" />
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );

  return (
    <CadreCarte
      hauteur={hauteur}
      surimpression={surimpression}
      initialViewState={VUE_INITIALE}
      interactiveLayerIds={[LAYER_VOTABLE, LAYER_REPERE, ...difficultes.map((d) => layerIdSentier(d.code))]}
        onLoad={(e) => majBounds(e.target)}
        onMoveEnd={(e) => majBounds(e.target)}
        onClick={(e) => {
          const f = e.features?.[0];
          if (!f || !f.properties) {
            setClique(null);
            setSentier(null);
            return;
          }
          const p = f.properties as Record<string, unknown>;
          const layerId = (f as { layer?: { id?: string } }).layer?.id ?? '';
          if (layerId.startsWith('sentiers-')) {
            setSentier({ nom: String(p.nom ?? 'Sentier'), difficulte: String(p.difficulte ?? 'non gradé') });
            setClique(null);
            return;
          }
          setSentier(null);
          setClique({
            osmId: String(p.osm_id ?? p.id ?? ''),
            nom: String(p.nom ?? 'Lieu'),
            categorie: p.categorie != null ? String(p.categorie) : null,
            tierDefaut: p.tier_defaut != null ? String(p.tier_defaut) : null,
            votable: p.votable === true || p.votable === 'true',
          });
        }}
      >
        {/* Découpage EN CONTEXTE, SOUS les POI (étape 2). Zoom-adaptatif : présent en vue d'ensemble, s'efface
            quand on zoome sur les lieux. Contours tiretés + label muté = repère, pas frontière ni sujet. */}
        {/* ZONES (C14) : aplat discret + limite + NOM, zoom-adaptatif (apparaît à l'échelle moyenne, sous les POI). */}
        {decoupage.zones.length ? (
          <Source id="exp-dec-zones" type="geojson" data={fcDe(decoupage.zones)}>
            <Layer
              id="exp-dec-zones-fill"
              type="fill"
              paint={{
                'fill-color': couleursDec.zone,
                'fill-opacity': exprNum(['interpolate', ['linear'], ['zoom'], 6, 0, 8, 0.06, 11, 0.05, 13, 0]),
              }}
            />
            <Layer
              id="exp-dec-zones-line"
              type="line"
              paint={{
                'line-color': couleursDec.zone,
                'line-width': 0.8,
                'line-opacity': exprNum(['interpolate', ['linear'], ['zoom'], 6, 0, 8, 0.5, 11, 0.3, 13, 0]),
              }}
            />
            <Layer
              id="exp-dec-zones-label"
              type="symbol"
              layout={{
                'text-field': exprStr(['get', 'nom_affichage']),
                'text-font': ['noto_sans_regular'],
                'text-size': exprNum(['interpolate', ['linear'], ['zoom'], 7, 10, 10, 13]),
                'text-max-width': 9,
              }}
              paint={{
                'text-color': couleursDec.label,
                'text-halo-color': couleursDec.labelHalo,
                'text-halo-width': 1.6,
                'text-opacity': exprNum(['interpolate', ['linear'], ['zoom'], 6.5, 0, 8, 0.85, 11.5, 0.7, 13, 0]),
              }}
            />
          </Source>
        ) : null}
        {/* SOUS-ZONES (C14) : VRAIS APLATS grain 147 (A110, polygones) au ZOOM rapproché, aplat discret + limite +
            NOM (`nom_affichage`, ex « Skagerrakkysten (Stavanger Jaeren) »). Sous les POI, un cran plus près que les
            zones. Zéro slug (le libellé propre vient de la donnée). */}
        {decoupage.sousZones.length ? (
          <Source id="exp-dec-souszones" type="geojson" data={fcDe(decoupage.sousZones)}>
            <Layer
              id="exp-dec-souszones-fill"
              type="fill"
              minzoom={9}
              paint={{ 'fill-color': couleursDec.zone, 'fill-opacity': exprNum(['interpolate', ['linear'], ['zoom'], 9, 0, 11, 0.05, 14, 0.04]) }}
            />
            <Layer
              id="exp-dec-souszones-line"
              type="line"
              minzoom={9}
              paint={{ 'line-color': couleursDec.zone, 'line-width': 0.6, 'line-opacity': exprNum(['interpolate', ['linear'], ['zoom'], 9, 0, 11, 0.4, 14, 0.3]) }}
            />
            <Layer
              id="exp-dec-souszones-label"
              type="symbol"
              minzoom={10}
              layout={{
                'text-field': exprStr(['get', 'nom_affichage']),
                'text-font': ['noto_sans_regular'],
                'text-size': exprNum(['interpolate', ['linear'], ['zoom'], 10, 10, 13, 13]),
                'text-max-width': 8,
                'text-padding': 6,
              }}
              paint={{
                'text-color': couleursDec.label,
                'text-halo-color': couleursDec.labelHalo,
                'text-halo-width': 1.8,
                'text-opacity': exprNum(['interpolate', ['linear'], ['zoom'], 10, 0, 11, 0.7, 11.5, 0.82, 14, 0.85]),
              }}
            />
          </Source>
        ) : null}
        {decoupage.regions.length ? (
          <Source id="exp-dec-regions" type="geojson" data={fcDe(decoupage.regions)}>
            <Layer
              id="exp-dec-regions-fill"
              type="fill"
              paint={{
                'fill-color': couleurRegion,
                'fill-opacity': exprNum(['interpolate', ['linear'], ['zoom'], 3, 0.13, 6, 0.1, 9, 0]),
              }}
            />
            <Layer
              id="exp-dec-regions-line"
              type="line"
              paint={{
                'line-color': couleurRegion,
                'line-width': 1.4,
                'line-opacity': exprNum(['interpolate', ['linear'], ['zoom'], 3, 0.6, 8, 0.4, 10, 0]),
              }}
            />
            <Layer
              id="exp-dec-regions-label"
              type="symbol"
              layout={{
                'text-field': exprStr(['get', 'id']),
                'text-font': ['noto_sans_bold'],
                'text-size': exprNum(['interpolate', ['linear'], ['zoom'], 3, 11, 6, 14]),
                'text-transform': 'uppercase',
                'text-letter-spacing': 0.06,
                'text-max-width': 10,
              }}
              paint={{
                'text-color': couleursDec.label,
                'text-halo-color': couleursDec.labelHalo,
                'text-halo-width': 2,
                'text-opacity': exprNum(['interpolate', ['linear'], ['zoom'], 3, 0.9, 7, 0.65, 8.5, 0]),
              }}
            />
          </Source>
        ) : null}

        {/* ORDRE DE RENDU (M375 §1) : les LIGNES (sentiers) sont posées AVANT les POINTS (POI) → les marqueurs et
            étiquettes restent TOUJOURS au-dessus des lignes, jamais coupés. Pile : aplats découpage → lignes → clusters
            → marqueurs POI → labels. */}
        {/* Sentiers rando RÉELS (2817, difficulté Turrutebasen) : une couche par difficulté, révélées au zoom.
            LISIBILITÉ (M372/QA) : un CASING de contraste sous toutes les traces (elles « décollent » du topo) + largeur
            INTERPOLÉE au zoom (plus épais à fort zoom, pas un trait fin constant). `non_grade` = gris discret. */}
        {(() => {
          // Sentiers : TUILES Martin (vector, prod) OU GeoJSON (static). Les couches sont identiques, `source-layer`
          // requis en vectoriel. Le casing (sous) puis les difficultés (dessus) ; largeurs interpolées + filtre difficulté.
          // Un TABLEAU d'éléments Layer (PAS un Fragment) : @vis.gl/react-maplibre injecte `source` dans les enfants
          // directs de <Source> ; un Fragment casse cette injection (les couches ne montent pas).
          const sl = sentiersTuiles ? { 'source-layer': martinSourceLayer('sentiers') } : {};
          const couches = [
            <Layer
              key="casing"
              id="sentiers-casing"
              type="line"
              {...sl}
              minzoom={SENTIERS_MINZOOM}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{
                'line-color': couleursDec.labelHalo,
                'line-width': exprNum(['interpolate', ['linear'], ['zoom'], 9, 3.5, 12, 6, 15, 9]),
                'line-opacity': 0.9,
              }}
            />,
            ...difficultes.map((d) => (
              <Layer
                key={d.code}
                id={layerIdSentier(d.code)}
                type="line"
                {...sl}
                minzoom={SENTIERS_MINZOOM}
                filter={['==', ['get', 'difficulte'], d.code]}
                layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                paint={{
                  'line-color': d.couleur,
                  'line-width': exprNum(['interpolate', ['linear'], ['zoom'], 9, 1.8, 12, 3.4, 15, 5.4]),
                  'line-opacity': d.code === 'non_grade' ? 0.7 : 0.95,
                }}
              />
            )),
          ];
          return sentiersTuiles ? (
            <Source id="sentiers" type="vector" tiles={[sentiersTuiles]} minzoom={5} maxzoom={14}>
              {couches}
            </Source>
          ) : (
            <Source id="sentiers" type="geojson" data={sentiers.data ?? VIDE}>
              {couches}
            </Source>
          );
        })()}

        {/* Calques POI par catégorie (étape 3, sous-étapes 2+3) : clustering au zoom + marqueur concept A
            (pastille+icône) au près, filtrés par le panneau. AU-DESSUS des lignes (M375 §1). */}
        {poiCat ? (
          <MarqueursCategories
            data={poiCat}
            actives={catActives}
            votablesOnly={votablesOnly}
            onSelectPoi={(f) =>
              setFichePoi(
                poiDeGeojson({
                  type: 'Feature',
                  properties: f.properties,
                  geometry: { type: 'Point', coordinates: f.geometry.coordinates },
                }),
              )
            }
          />
        ) : null}

        {/* Couche RECOS animée (M379/M426) : recommandations du voyageur actif, marqueurs pulsés hors-clustering, à tous
            zooms ; clic → fitBounds sous-zone centrée (M381) → fiche pour voter. */}
        {recos.length ? <CoucheRecos recos={recos} onSelect={(r) => setFichePoi(poiDeReco(r))} /> : null}

        <Source id="poi-explorer" type="geojson" data={donnees}>
          <Layer
            id={LAYER_REPERE}
            type="circle"
            filter={['!=', ['get', 'votable'], true]}
            paint={{ 'circle-radius': 3, 'circle-color': couleurs.repere, 'circle-opacity': 0.5 }}
          />
          <Layer
            id={LAYER_VOTABLE}
            type="circle"
            filter={['==', ['get', 'votable'], true]}
            paint={{
              'circle-radius': 5,
              'circle-color': couleurs.votable,
              'circle-stroke-color': couleurs.bord,
              'circle-stroke-width': 1,
            }}
          />
        </Source>

        {/* Circuits à pied de ville : `v_web_circuits` est en LIGNE (LineString, B123/M411) → figuré LIGNE anticipé
            (couche vide en dev, correct dès le dump final). Casing de contraste + trait TIRETÉ d'une couleur DISTINCTE des
            sentiers (accent, pour ne pas confondre trace rando et circuit urbain). Largeur interpolée au zoom. */}
        <Source id="circuits" type="geojson" data={circuits.data ?? VIDE}>
          <Layer
            id="circuits-casing"
            type="line"
            minzoom={SENTIERS_MINZOOM}
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{
              'line-color': couleursDec.labelHalo,
              'line-width': exprNum(['interpolate', ['linear'], ['zoom'], 9, 3, 12, 5.5, 15, 8]),
              'line-opacity': 0.9,
            }}
          />
          <Layer
            id="circuits-line"
            type="line"
            minzoom={SENTIERS_MINZOOM}
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{
              'line-color': couleurs.circuit,
              'line-width': exprNum(['interpolate', ['linear'], ['zoom'], 9, 1.6, 12, 3, 15, 5]),
              'line-dasharray': [1.5, 1.2],
              'line-opacity': 0.95,
            }}
          />
        </Source>
    </CadreCarte>
  );
}
