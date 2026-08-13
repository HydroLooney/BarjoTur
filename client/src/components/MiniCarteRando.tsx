import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useMemo } from 'react';
import { Map, Source, Layer, Marker, useMap } from '@vis.gl/react-maplibre';
import type { FeatureCollection, Geometry, Position } from 'geojson';
import { charte } from '@/ui/theme';
import { useUi } from '@/stores/ui';

// Mini-carte STATIQUE du tracé d'un circuit rando (A11 : voir le circuit avant de voter). Un seul
// contexte WebGL, non interactive (aperçu). Ligne pour un circuit, marqueur pour un point. Couleur
// par jeton (zéro hex). Alimentée par la géométrie du POI (CataloguePoi.geometrie), pas d'appel dédié.

const FOND = 'https://tiles.openfreemap.org/styles/positron';

type Bornes = [[number, number], [number, number]];

function toutesCoords(g: Geometry): Position[] {
  switch (g.type) {
    case 'Point':
      return [g.coordinates];
    case 'MultiPoint':
    case 'LineString':
      return g.coordinates;
    case 'MultiLineString':
    case 'Polygon':
      return g.coordinates.flat();
    case 'MultiPolygon':
      return g.coordinates.flat(2);
    case 'GeometryCollection':
      return g.geometries.flatMap(toutesCoords);
    default:
      return [];
  }
}

function bornes(coords: Position[]): Bornes | null {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const c of coords) {
    const lon = c[0];
    const lat = c[1];
    if (lon == null || lat == null) continue;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  if (minLon === Infinity) return null;
  return [
    [minLon, minLat],
    [maxLon, maxLat],
  ];
}

function Cadrage({ b }: { b: Bornes | null }) {
  const { current: carte } = useMap();
  useEffect(() => {
    if (carte && b) carte.fitBounds(b, { padding: 24, duration: 0 });
  }, [carte, b]);
  return null;
}

export function MiniCarteRando({ geom, hauteur = '220px' }: { geom: Geometry; hauteur?: string }) {
  const theme = useUi((s) => s.theme);
  const couleur = useMemo(() => charte('--ocre'), [theme]);
  const coords = useMemo(() => toutesCoords(geom), [geom]);
  const b = useMemo(() => bornes(coords), [coords]);
  const estLigne = geom.type === 'LineString' || geom.type === 'MultiLineString';
  const centre = coords[0];
  const lon0 = centre?.[0];
  const lat0 = centre?.[1];
  const fc: FeatureCollection = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: geom }] };

  return (
    <div className="overflow-hidden rounded-md border border-border" style={{ height: hauteur }}>
      <Map
        initialViewState={{ longitude: lon0 ?? 8, latitude: lat0 ?? 61, zoom: 8 }}
        mapStyle={FOND}
        style={{ width: '100%', height: '100%' }}
        interactive={false}
      >
        <Cadrage b={b} />
        {estLigne ? (
          <Source id="rando" type="geojson" data={fc}>
            <Layer
              id="rando-ligne"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': couleur, 'line-width': 4 }}
            />
          </Source>
        ) : lon0 != null && lat0 != null ? (
          <Marker longitude={lon0} latitude={lat0}>
            <span
              aria-hidden
              style={{
                display: 'block',
                width: 12,
                height: 12,
                borderRadius: '9999px',
                background: 'var(--ocre)',
                border: '2px solid var(--papier)',
              }}
            />
          </Marker>
        ) : null}
      </Map>
    </div>
  );
}
