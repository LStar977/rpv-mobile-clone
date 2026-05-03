// Equirectangular projection (plate carrée): simple, no polar singularity.
// World fits in a 2:1 box. Latitude maps linearly to y; longitude to x.
export type Projection = (lon: number, lat: number) => [number, number];

export function makeEquirectangular(width: number, height: number): Projection {
  return (lon, lat) => [
    ((lon + 180) / 360) * width,
    ((90 - lat) / 180) * height,
  ];
}

type Position = [number, number];
type LineString = Position[];
type Polygon = LineString[];
type Geometry =
  | { type: 'Polygon'; coordinates: Polygon }
  | { type: 'MultiPolygon'; coordinates: Polygon[] };

function ringToPath(ring: LineString, project: Projection): string {
  if (ring.length === 0) return '';
  const [lon0, lat0] = ring[0];
  const [x0, y0] = project(lon0, lat0);
  let d = `M${x0.toFixed(2)},${y0.toFixed(2)}`;
  for (let i = 1; i < ring.length; i++) {
    const [lon, lat] = ring[i];
    const [x, y] = project(lon, lat);
    d += `L${x.toFixed(2)},${y.toFixed(2)}`;
  }
  return d + 'Z';
}

export function geometryToPath(geometry: Geometry, project: Projection): string {
  if (geometry.type === 'Polygon') {
    return geometry.coordinates.map(r => ringToPath(r, project)).join('');
  }
  return geometry.coordinates
    .flatMap(poly => poly.map(r => ringToPath(r, project)))
    .join('');
}

// Centroid: average of all coordinates in the largest polygon ring.
// Fast, good-enough for placing a glow dot or a count badge.
export function geometryCentroid(geometry: Geometry): [number, number] {
  let largest: LineString = [];
  if (geometry.type === 'Polygon') {
    for (const ring of geometry.coordinates) {
      if (ring.length > largest.length) largest = ring;
    }
  } else {
    for (const poly of geometry.coordinates) {
      for (const ring of poly) {
        if (ring.length > largest.length) largest = ring;
      }
    }
  }
  if (largest.length === 0) return [0, 0];
  let sumLon = 0;
  let sumLat = 0;
  for (const [lon, lat] of largest) {
    sumLon += lon;
    sumLat += lat;
  }
  return [sumLon / largest.length, sumLat / largest.length];
}
