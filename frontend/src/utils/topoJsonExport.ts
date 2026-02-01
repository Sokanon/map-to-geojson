import * as topojson from 'topojson-server';
import { Building } from '../types';

interface GeoJSONFeature {
  type: 'Feature';
  properties: { id: number; building: string };
  geometry: { type: 'Polygon'; coordinates: number[][][] };
}

interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

export function buildingsToGeoJSON(buildings: Building[]): GeoJSONFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: buildings.map((b) => ({
      type: 'Feature' as const,
      properties: { id: b.id, building: b.label },
      geometry: { type: 'Polygon' as const, coordinates: b.polygon },
    })),
  };
}

export function exportToTopoJSON(buildings: Building[]): string {
  const geojson = buildingsToGeoJSON(buildings);
  const topo = topojson.topology({ buildings: geojson });
  return JSON.stringify(topo, null, 2);
}

export function exportToGeoJSON(buildings: Building[]): string {
  const geojson = buildingsToGeoJSON(buildings);
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
