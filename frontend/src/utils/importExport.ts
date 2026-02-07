import { Unit } from '../types';
import { getPolygonCentroid } from './geometry';

interface GeoJSONFeature {
  type: string;
  geometry?: { type: string; coordinates: number[][][] };
  properties?: Record<string, any>;
}

interface GeoJSONFeatureCollection {
  type: string;
  features: GeoJSONFeature[];
}

function extractUnit(feature: GeoJSONFeature, collectionName?: string): Unit | null {
  if (feature.geometry?.type !== 'Polygon') return null;
  const coords = feature.geometry.coordinates;
  const [cx, cy] = getPolygonCentroid(coords);
  const collection = feature.properties?.collection ||
    (collectionName && collectionName !== 'uncategorized' ? collectionName : undefined);
  return {
    id: 0,
    label: feature.properties?.name || feature.properties?.unit || feature.properties?.building || feature.properties?.label || '',
    polygon: coords,
    centroid: [cx, cy],
    collection,
  };
}

function extractFromFeatureCollection(collection: GeoJSONFeatureCollection, collectionName?: string): Unit[] {
  const units: Unit[] = [];
  for (const feature of collection.features) {
    const unit = extractUnit(feature, collectionName);
    if (unit) units.push(unit);
  }
  return units;
}

export async function parseImportedUnits(raw: string): Promise<Unit[]> {
  const json = JSON.parse(raw);
  const importedUnits: Unit[] = [];

  if (json.type === 'FeatureCollection' && Array.isArray(json.features)) {
    importedUnits.push(...extractFromFeatureCollection(json as GeoJSONFeatureCollection));
  } else if (json.type === 'Topology') {
    const topojson = await import('topojson-client');
    for (const objectKey of Object.keys(json.objects || {})) {
      const geojson = topojson.feature(json, json.objects[objectKey]) as any;
      if (geojson.type === 'FeatureCollection') {
        importedUnits.push(...extractFromFeatureCollection(geojson, objectKey));
      } else if (geojson.type === 'Feature') {
        const unit = extractUnit(geojson, objectKey);
        if (unit) importedUnits.push(unit);
      }
    }
  }

  return importedUnits;
}
