import { Source, Layer } from '@vis.gl/react-maplibre';
import type { CleFond } from '@/lib/fonds-carte';
import { useUi } from '@/stores/ui';

// Multi-échelle amortie (DOCTRINE-CARTO §2) SANS second contexte WebGL (A05) : le topo raster hébergé est une
// COUCHE au-dessus du fond vectoriel, sous la donnée. Son opacité est interpolée par le zoom (fondu amorti au
// palier ~1/25000), donc la bascule est douce, jamais un flash de rechargement de style.
//  - fond auto (Doux/Épuré/Coloré) : topo transparent en vue d'ensemble, apparaît au zoom rapproché (relief +
//    sentiers, utile pour inspecter une rando).
//  - fond « Relief » choisi explicitement : topo plein à tous les zooms (le choix utilisateur prime, §2).
// Rendue AVANT la donnée dans CadreCarte → reste sous les aplats/marqueurs. Attribution OSM/OpenTopoMap portée
// par la source (respect de la licence CC-BY-SA).

const TUILES_TOPO = [
  'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
  'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
  'https://c.tile.opentopomap.org/{z}/{x}/{y}.png',
];

const ATTRIBUTION = '© OpenTopoMap (CC-BY-SA) · © OpenStreetMap';

export function CoucheTopo({ fond }: { fond: CleFond }) {
  // Le fond VECTORIEL passe en sombre par les jetons (charte). Le topo RASTER OpenTopoMap, lui, est une image CLAIRE qui
  // ne suit pas le thème → en sombre elle « lâche » à haut zoom (rues blanches, M436). Correctif : on l'ASSOMBRIT via les
  // paint raster NATIFS de MapLibre (fiable, pas un filtre CSS) — plafond de luminosité bas + désaturation → cohérent à
  // tous les zooms, dark-safe. En clair, aucun traitement (raster tel quel).
  const sombre = useUi((s) => s.theme) === 'sombre';
  // Opacité : pleine si Relief explicite, sinon rampe douce z11 (0) → z14.5 (1) — l'amorti du fondu au palier.
  // L'expression est castée à `number` (son type de sortie par tuile) : MapLibre accepte l'expression au runtime ;
  // le cast évite le heurt de versions entre les deux copies du style-spec (maplibre-gl / @maplibre/…).
  const opacite: number =
    fond === 'topo'
      ? 1
      : (['interpolate', ['linear'], ['zoom'], 11, 0, 14.5, 1] as unknown as number);

  return (
    <Source id="fond-topo" type="raster" tiles={TUILES_TOPO} tileSize={256} attribution={ATTRIBUTION} maxzoom={17}>
      {/* minzoom 10 : en vue d'ensemble le topo est inutile (opacité ~0) — on évite de charger des tuiles raster
          pour rien. Il n'entre en jeu qu'à l'approche, là où la rampe d'opacité le fait apparaître. */}
      <Layer
        id="fond-topo-couche"
        type="raster"
        minzoom={10}
        paint={{
          'raster-opacity': opacite,
          // Sombre : assombrit + désature le raster clair → cohérent avec le thème à tous les zooms (M436). Clair : neutre.
          'raster-brightness-max': sombre ? 0.5 : 1,
          'raster-saturation': sombre ? -0.35 : 0,
          'raster-contrast': sombre ? -0.12 : 0,
        }}
      />
    </Source>
  );
}
