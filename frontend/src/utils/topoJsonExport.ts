import * as topojson from 'topojson-server';
import { Unit } from '../types';

interface GeoJSONFeature {
  type: 'Feature';
  properties: { unit_id: number; name: string };
  geometry: { type: 'Polygon'; coordinates: number[][][] };
}

interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

export function unitsToGeoJSON(units: Unit[]): GeoJSONFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: units.map((u) => ({
      type: 'Feature' as const,
      properties: { unit_id: u.id, name: u.label },
      geometry: { type: 'Polygon' as const, coordinates: u.polygon },
    })),
  };
}

export function exportToTopoJSON(units: Unit[]): string {
  const geojson = unitsToGeoJSON(units);
  const topo = topojson.topology({ units: geojson });
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
