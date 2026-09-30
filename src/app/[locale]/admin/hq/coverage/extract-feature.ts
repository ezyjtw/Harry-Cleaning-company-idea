// R9 HQ — client-side twin of coverage.service's extractPolygon (that module
// pulls server-only imports, so the map bundle carries its own copy of this
// small pure parser).

type GeoJsonPolygonish = {
  type: string;
  features?: { geometry?: { type?: string } }[];
  geometry?: { type?: string };
  coordinates?: unknown;
};

export function extractFeature(
  raw: unknown
): GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null {
  if (!raw || typeof raw !== 'object') return null;
  const g = raw as GeoJsonPolygonish;
  try {
    if (g.type === 'FeatureCollection' && Array.isArray(g.features)) {
      const f = g.features.find(
        (feat) => feat?.geometry?.type === 'Polygon' || feat?.geometry?.type === 'MultiPolygon'
      );
      return (f as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>) ?? null;
    }
    if (
      g.type === 'Feature' &&
      (g.geometry?.type === 'Polygon' || g.geometry?.type === 'MultiPolygon')
    ) {
      return g as unknown as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
    }
    if ((g.type === 'Polygon' || g.type === 'MultiPolygon') && g.coordinates) {
      return {
        type: 'Feature',
        properties: {},
        geometry: g as unknown as GeoJSON.Polygon | GeoJSON.MultiPolygon,
      };
    }
  } catch {
    return null;
  }
  return null;
}
