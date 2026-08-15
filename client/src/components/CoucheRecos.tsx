import { Marker, useMap } from '@vis.gl/react-maplibre';
import type { Reco } from '@barjotur/shared';
import type { Feature, Geometry } from 'geojson';
import { useDecoupageData } from '@/lib/decoupage';
import { bboxDeFeatures } from '@/lib/carte-cadrage';

// Couche RECOS animée (M379/M381/M426) : les recommandations du voyageur ACTIF, en marqueurs DOM (react-maplibre) au
// halo PULSÉ (CSS → hors canvas, captures stables, reduced-motion respecté). Épinglés AU-DESSUS du clustering (les
// Markers DOM sont toujours devant les couches canvas), à TOUS les zooms, jamais agglomérés. Clic → `fitBounds` sur la
// SOUS-ZONE d'appartenance CENTRÉE (M381) → puis ouvre la fiche pour voter (via `onSelect`). Fallback : centre sur le point.
export function CoucheRecos({ recos, onSelect }: { recos: Reco[]; onSelect: (r: Reco) => void }) {
  const { current: carte } = useMap();
  const dec = useDecoupageData();

  function cliquer(r: Reco) {
    const map = carte?.getMap?.() as unknown as
      | { fitBounds: (b: number[][], o?: object) => void; easeTo: (o: object) => void }
      | undefined;
    const sz =
      r.sous_zone_id != null
        ? (dec.sousZones as Feature<Geometry>[]).find((f) => String(f.properties?.id) === String(r.sous_zone_id))
        : undefined;
    const bornes = sz ? bboxDeFeatures([sz]) : null; // [[ouest,sud],[est,nord]] = format fitBounds
    if (map && bornes) {
      map.fitBounds(bornes, { padding: 60, duration: 700, maxZoom: 13 });
    } else if (map) {
      map.easeTo({ center: [r.lon, r.lat], zoom: 12, duration: 700 });
    }
    onSelect(r);
  }

  return (
    <>
      {recos.map((r) => (
        <Marker
          key={r.cle}
          longitude={r.lon}
          latitude={r.lat}
          onClick={(e) => {
            (e.originalEvent as MouseEvent).stopPropagation();
            cliquer(r);
          }}
        >
          <button
            type="button"
            aria-label={`Recommandation pour vous : ${r.nom}`}
            title={`Recommandé pour vous : ${r.nom}`}
            className="relative grid h-4 w-4 place-items-center focus-visible:outline-none"
          >
            {/* Halo pulsé (CSS) derrière la pastille. */}
            <span className="reco-halo absolute inset-0 rounded-full" style={{ backgroundColor: 'var(--accent)' }} aria-hidden />
            {/* Pastille de reco : contour clair pour décoller du fond. */}
            <span
              className="relative h-3 w-3 rounded-full border-2"
              style={{ backgroundColor: 'var(--accent)', borderColor: 'var(--papier)' }}
              aria-hidden
            />
          </button>
        </Marker>
      ))}
    </>
  );
}
