import * as topojson from 'topojson-server';
import { Unit } from '../types';

interface GeoJSONFeature {
  type: 'Feature';
  properties: { unit_id: number; name: string; collection: string | null };
  geometry: { type: 'Polygon'; coordinates: number[][][] };
}

interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

const UNCATEGORIZED_KEY = 'uncategorized';

export function unitsToGeoJSON(units: Unit[]): GeoJSONFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: units.map((u) => ({
      type: 'Feature' as const,
      properties: {
        unit_id: u.id,
        name: u.label,
        collection: u.collection || null,
      },
      geometry: { type: 'Polygon' as const, coordinates: u.polygon },
    })),
  };
}

function groupUnitsByCollection(units: Unit[]): Map<string, Unit[]> {
  const groups = new Map<string, Unit[]>();

  for (const unit of units) {
    const key = unit.collection || UNCATEGORIZED_KEY;
    const existing = groups.get(key) || [];
    existing.push(unit);
    groups.set(key, existing);
  }

  return groups;
}

export function exportToTopoJSON(units: Unit[]): string {
  const grouped = groupUnitsByCollection(units);

  // Create a GeoJSON FeatureCollection for each collection
  const objects: Record<string, GeoJSONFeatureCollection> = {};

  for (const [collectionName, collectionUnits] of grouped) {
    objects[collectionName] = {
      type: 'FeatureCollection',
      features: collectionUnits.map((u) => ({
        type: 'Feature' as const,
        properties: {
          unit_id: u.id,
          name: u.label,
          collection: u.collection || null,
        },
        geometry: { type: 'Polygon' as const, coordinates: u.polygon },
      })),
    };
  }

  const topo = topojson.topology(objects);
  return JSON.stringify(topo, null, 2);
}

export function exportToGeoJSON(units: Unit[]): string {
  const geojson = unitsToGeoJSON(units);
  return JSON.stringify(geojson, null, 2);
}

export function downloadFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
