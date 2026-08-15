import 'maplibre-gl/dist/maplibre-gl.css';
import { useMemo, useState } from 'react';
import { Source, Layer } from '@vis.gl/react-maplibre';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { charte } from '@/ui/theme';
import { CadreCarte } from '@/components/CadreCarte';
import { useUi } from '@/stores/ui';
import { useDecoupageData } from '@/lib/decoupage';
import { libelleNiveau } from '@/lib/decoupage';
import { useCartoData } from '@/lib/carto-source';
import { CadrageAuto, bboxDeFeatures } from '@/lib/carte-cadrage';
import { cn } from '@/lib/utils';

// C15 (M286/M434) : DRILL-DOWN interactif du decoupage, Region › District › Paysage. On descend l'emboitement reel
// (parent_id) niveau par niveau : la carte re-cadre a chaque palier (CadrageAuto), le fil d'ariane remonte. Les
// enfants du niveau courant sont des aplats sur la carte ET des puces cliquables (robuste, tactile, sans dependre
// d'un clic WebGL). Au dernier niveau (paysage), on lit ce que la donnee dit honnetement : couvert par des lieux ou
// non (R1, `couverte_par`). Un seul contexte WebGL via CadreCarte (A05), couleurs aux jetons (dark-safe, zero hex).

const VUE = { longitude: 8.4, latitude: 61, zoom: 4.4 };

// Palette des enfants : on mene par le frais (leçon carto M235) puis chaud franc, cyclee sur les enfants du palier.
const TOKENS = ['--glacier', '--vert', '--espace-mes-envies', '--ocre', '--granite'];
const tokenEnfant = (i: number): string => TOKENS[i % TOKENS.length] ?? '--glacier';

const exprNum = (e: unknown): number => e as unknown as number;
const exprStr = (e: unknown): string => e as unknown as string;

type Niveau = 'region' | 'zone' | 'sous_zone';

interface Palier {
  niveau: Niveau;
  id: string;
  nom: string;
}

function fc(features: Feature<Geometry>[]): FeatureCollection {
  return { type: 'FeatureCollection', features };
}

const nomFeature = (f: Feature<Geometry>): string => String(f.properties?.nom_affichage ?? f.properties?.id ?? '');
const idFeature = (f: Feature<Geometry>): string => String(f.properties?.id ?? '');

export function DrillDownDecoupage({ hauteur = '68vh' }: { hauteur?: string }) {
  const theme = useUi((s) => s.theme);
  const { regions, zones, sousZones, isLoading, isError } = useDecoupageData();
  // Chemin de descente : [] = niveau Region, [region] = niveau District, [region, zone] = niveau Paysage.
  const [chemin, setChemin] = useState<Palier[]>([]);
  // POI reels (v_web_poi) pour compter les lieux rattaches a un paysage (M438 : sous_zone_id STRING = slug paysage,
  // 597/767 peuples ; les 170 sans rattachement sont dits honnetement). Chargement partage (react-query dedupe).
  const poi = useCartoData('poi');
  const comptePoiParPaysage = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of poi.data?.features ?? []) {
      const sz = f.properties?.sous_zone_id;
      if (typeof sz === 'string' && sz) m.set(sz, (m.get(sz) ?? 0) + 1);
    }
    return m;
  }, [poi.data]);

  // Les enfants du palier courant, filtres sur le parent selectionne (emboitement reel via parent_id).
  const enfants = useMemo<Feature<Geometry>[]>(() => {
    if (chemin.length === 0) return regions;
    const parent = chemin[chemin.length - 1];
    if (!parent) return regions;
    if (parent.niveau === 'region') return zones.filter((z) => String(z.properties?.parent_id) === parent.id);
    if (parent.niveau === 'zone') return sousZones.filter((s) => String(s.properties?.parent_id) === parent.id);
    return [];
  }, [chemin, regions, zones, sousZones]);

  // Le paysage retenu au dernier niveau (feuille) : le dernier palier s'il est une sous-zone.
  const feuille = chemin.length === 3 ? chemin[2] : null;
  const featureFeuille = useMemo<Feature<Geometry> | null>(
    () => (feuille ? sousZones.find((s) => idFeature(s) === feuille.id) ?? null : null),
    [feuille, sousZones],
  );

  // Niveau AFFICHE (celui des enfants qu'on propose) : region → zone → sous_zone.
  const niveauEnfant: Niveau = chemin.length === 0 ? 'region' : chemin.length === 1 ? 'zone' : 'sous_zone';
  const niveauEnfantSuivant: Niveau | null =
    niveauEnfant === 'region' ? 'zone' : niveauEnfant === 'zone' ? 'sous_zone' : null;

  // Emprise : les enfants proposes (ou la feuille au dernier niveau). CadrageAuto re-cadre a chaque descente.
  const bornes = useMemo(
    () => bboxDeFeatures(featureFeuille ? [featureFeuille] : enfants),
    [enfants, featureFeuille],
  );

  const surCouche = featureFeuille ? [featureFeuille] : enfants;

  // Couleur par enfant (match id → jeton), recalculee au theme.
  const couleurEnfant = useMemo<string>(() => {
    const ids = surCouche.map(idFeature);
    const paires = ids.flatMap((id, i) => [id, charte(tokenEnfant(i))]);
    return exprStr(['match', ['get', 'id'], ...paires, charte('--glacier')]);
  }, [surCouche, theme]);

  const c = useMemo(
    () => ({ etiquette: charte('--foreground'), etiquetteHalo: charte('--carte-etiquette-halo') }),
    [theme],
  );

  const descendre = (f: Feature<Geometry>) => {
    if (!niveauEnfantSuivant && niveauEnfant !== 'sous_zone') return;
    setChemin((ch) => [...ch, { niveau: niveauEnfant, id: idFeature(f), nom: nomFeature(f) }]);
  };
  const remonterA = (profondeur: number) => setChemin((ch) => ch.slice(0, profondeur));

  const estFeuille = niveauEnfant === 'sous_zone' && feuille != null;

  return (
    <div className="space-y-3">
      {/* Fil d'ariane du drill-down : Norvege › Region › District › Paysage, chaque cran cliquable pour remonter. */}
      <nav aria-label="Fil du découpage" className="flex flex-wrap items-center gap-1 text-sm">
        <button
          type="button"
          onClick={() => remonterA(0)}
          className={cn('rounded px-1.5 py-0.5 hover:underline', chemin.length === 0 ? 'font-medium' : 'text-accent')}
        >
          Norvège
        </button>
        {chemin.map((p, i) => (
          <span key={p.id} className="flex items-center gap-1">
            <span aria-hidden className="text-muted-foreground">›</span>
            <button
              type="button"
              onClick={() => remonterA(i + 1)}
              className={cn('rounded px-1.5 py-0.5 hover:underline', i === chemin.length - 1 ? 'font-medium' : 'text-accent')}
            >
              {p.nom}
            </button>
          </span>
        ))}
      </nav>

      <div className="grid gap-3 lg:grid-cols-[1fr_18rem]">
        <CadreCarte hauteur={hauteur} initialViewState={VUE}>
          <CadrageAuto bornes={bornes} />
          {surCouche.length ? (
            <Source id="drill-enfants" type="geojson" data={fc(surCouche)}>
              <Layer id="drill-enfants-fill" type="fill" paint={{ 'fill-color': couleurEnfant, 'fill-opacity': estFeuille ? 0.32 : 0.24 }} />
              <Layer id="drill-enfants-line" type="line" paint={{ 'line-color': couleurEnfant, 'line-width': 1.8 }} />
              <Layer
                id="drill-enfants-label"
                type="symbol"
                layout={{
                  'text-field': exprStr(['coalesce', ['get', 'nom_affichage'], ['get', 'id']]),
                  'text-font': ['noto_sans_bold'],
                  'text-size': exprNum(['interpolate', ['linear'], ['zoom'], 4, 10, 8, 14]),
                  'text-max-width': 9,
                  'text-padding': 6,
                }}
                paint={{ 'text-color': c.etiquette, 'text-halo-color': c.etiquetteHalo, 'text-halo-width': 2 }}
              />
            </Source>
          ) : null}
        </CadreCarte>

        {/* Panneau des enfants du palier : puces cliquables pour descendre (ou lecture de la feuille au dernier niveau). */}
        <div className="space-y-2">
          {isError ? (
            <p className="text-sm text-muted-foreground">Découpage indisponible pour le moment.</p>
          ) : isLoading && regions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chargement du découpage…</p>
          ) : estFeuille && featureFeuille ? (
            <div className="space-y-2 rounded-lg border border-border bg-card p-3 shadow-posee">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Dernier niveau · paysage</p>
              <p className="text-sm font-medium">{nomFeature(featureFeuille)}</p>
              {(() => {
                // Compte reel des lieux rattaches a ce paysage (v_web_poi.sous_zone_id, M438). Honnete : si 0, on le
                // dit ; sinon on donne le nombre exact plutot que le seul binaire couverte_par.
                const n = comptePoiParPaysage.get(feuille?.id ?? '') ?? 0;
                return (
                  <p className="text-sm text-muted-foreground">
                    {n > 0 ? (
                      <>
                        <span className="chiffres font-medium text-foreground">{n}</span> lieu{n > 1 ? 'x' : ''} rattaché
                        {n > 1 ? 's' : ''} à ce paysage.
                      </>
                    ) : featureFeuille.properties?.couverte_par === 'sans_poi' ? (
                      'Aucun lieu référencé dans ce paysage pour l’instant.'
                    ) : (
                      'Pas encore de lieu rattaché à ce paysage.'
                    )}
                  </p>
                );
              })()}
              <button type="button" onClick={() => remonterA(2)} className="text-sm text-accent hover:underline">
                ← Revenir aux paysages voisins
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {libelleNiveau(niveauEnfant)}s · <span className="chiffres">{enfants.length}</span>
              </p>
              <ul className="space-y-1">
                {enfants.map((f, i) => (
                  <li key={idFeature(f)}>
                    <button
                      type="button"
                      onClick={() => descendre(f)}
                      className="flex min-h-tactile w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-left text-sm shadow-posee transition-colors duration-court hover:bg-muted"
                    >
                      <span aria-hidden className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: charte(tokenEnfant(i)) }} />
                      <span className="flex-1">{nomFeature(f)}</span>
                      {niveauEnfantSuivant ? <span aria-hidden className="text-muted-foreground">›</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
