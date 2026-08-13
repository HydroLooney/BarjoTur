// Contrats géométriques partagés. On s'aligne sur GeoJSON (RFC 7946), en WGS84 (lon, lat).
// Backbone posé par le Maître (C01). Les Workers étendent au besoin, sans casser le socle.

/** Une position GeoJSON, ordre [longitude, latitude]. */
export type Position = [number, number];

export interface PointGeom {
  type: 'Point';
  coordinates: Position;
}

export interface LineStringGeom {
  type: 'LineString';
  coordinates: Position[];
}

/** Géométrie de base. À élargir (MultiLineString, Polygon...) quand un module en a besoin. */
export type Geometry = PointGeom | LineStringGeom;

export interface Feature<P = Record<string, unknown>> {
  type: 'Feature';
  geometry: Geometry;
  properties: P;
}

export interface FeatureCollection<P = Record<string, unknown>> {
  type: 'FeatureCollection';
  features: Feature<P>[];
}
