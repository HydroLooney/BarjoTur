import 'maplibre-gl/dist/maplibre-gl.css';
import { useMemo, useState } from 'react';
import { Source, Layer } from '@vis.gl/react-maplibre';
import type { FeatureCollection } from 'geojson';
import type { VoteTier } from '@barjotur/shared';
import { useBboxPois, type BBox } from '@/lib/queries/poi-bbox';
import { SelecteurTier } from '@/ui/blocs/SelecteurTier';
import { charte } from '@/ui/theme';
import { CadreCarte } from '@/components/CadreCarte';
import { useUi } from '@/stores/ui';
import { useIdentite } from '@/stores/identite';
import { usePeut } from '@/hooks/usePeut';
import { useMesVotes, useVoteUnitaire } from '@/lib/queries/votes';

// Carte Explorer (C15 / A05) : TOUS les POI de l'emprise visible, en deux couches DISTINCTES (votables
// = pastille ocre ; repères non-votables = petit point granite discret, A13). Anti-cadrage : aucune
// couleur de score portée sur la carte. Cliquer un POI ouvre un panneau où le vote est reposable
// (réutilise SelecteurTier). Un seul contexte WebGL, couleurs par jetons (zéro hex, darkmode-aware).

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

  const code = useIdentite((s) => s.code);
  const peutVoter = usePeut('voter');
  const { data: mesVotes } = useMesVotes(code);
  const voter = useVoteUnitaire(code);

  const couleurs = useMemo(
    () => ({ votable: charte('--ocre'), repere: charte('--granite'), bord: charte('--papier') }),
    [theme],
  );

  const donnees = fc ?? VIDE;

  // Interface structurelle minimale : évite le conflit de types `Map` entre maplibre-gl (client) et le
  // bundle maplibre embarqué par @vis.gl/react-maplibre (mêmes membres, types nominalement distincts).
  function majBounds(map: { getBounds: () => LngLatBornes }): void {
    const b = map.getBounds();
    setBbox({ minlon: b.getWest(), minlat: b.getSouth(), maxlon: b.getEast(), maxlat: b.getNorth() });
  }

  const monTier: VoteTier | null = clique ? (mesVotes?.tiers[`p:${clique.osmId}`] ?? null) : null;

  const surimpression = clique ? (
    <div className="absolute inset-x-2 bottom-2 rounded-lg border border-border bg-card p-3 shadow-charte">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-serif text-base">{clique.nom}</p>
          {clique.categorie ? <p className="text-xs text-muted-foreground">{clique.categorie}</p> : null}
        </div>
        <button
          type="button"
          className="min-h-tactile px-2 text-lg text-muted-foreground hover:text-foreground"
          onClick={() => setClique(null)}
          aria-label="Fermer"
        >
          ×
        </button>
      </div>
      <div className="mt-2">
        {clique.votable ? (
          <SelecteurTier
            monTier={monTier}
            tierDefaut={clique.tierDefaut}
            disabled={!peutVoter}
            onChoisir={(tier) => voter.mutate({ ref: `p:${clique.osmId}`, tier: tier ?? undefined })}
          />
        ) : (
          <span className="text-xs text-muted-foreground">Repère non votable.</span>
        )}
      </div>
    </div>
  ) : (
    <div className="pointer-events-none absolute inset-x-0 top-0 bg-card/80 px-3 py-1.5 text-xs text-muted-foreground">
      {donnees.features.length} lieux dans la vue. Touchez un point pour voter.
    </div>
  );

  return (
    <CadreCarte
      hauteur={hauteur}
      surimpression={surimpression}
      initialViewState={VUE_INITIALE}
      interactiveLayerIds={[LAYER_VOTABLE, LAYER_REPERE]}
        onLoad={(e) => majBounds(e.target)}
        onMoveEnd={(e) => majBounds(e.target)}
        onClick={(e) => {
          const f = e.features?.[0];
          if (!f || !f.properties) {
            setClique(null);
            return;
          }
          const p = f.properties as Record<string, unknown>;
          setClique({
            osmId: String(p.osm_id ?? p.id ?? ''),
            nom: String(p.nom ?? 'Lieu'),
            categorie: p.categorie != null ? String(p.categorie) : null,
            tierDefaut: p.tier_defaut != null ? String(p.tier_defaut) : null,
            votable: p.votable === true || p.votable === 'true',
          });
        }}
      >
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
    </CadreCarte>
  );
}
