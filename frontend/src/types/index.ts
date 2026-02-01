// Smart Map Digitizer Types

export interface Building {
  id: number;
  label: string;
  polygon: number[][][]; // GeoJSON polygon coordinates
  centroid: [number, number];
  loading?: boolean; // True while API call is in progress
  clickPosition?: [number, number]; // Where user clicked (for loading indicator)
}

export interface PendingSelection {
  polygon: number[][][];
  bbox: { x: number; y: number; width: number; height: number };
  ocrText: string;
  confidence: number;
  centroid: [number, number];
}

export interface DigitizerState {
  imageData: string | null;
  imageWidth: number;
  imageHeight: number;
  tolerance: number;
  pendingSelection: PendingSelection | null;
  buildings: Building[];
  nextId: number;
  isLoading: boolean;
  highlightedBuildingId: number | null;
}

export interface MagicWandResponse {
  success: boolean;
  polygon?: number[][][];
  centroid?: [number, number];
  bbox?: { x: number; y: number; width: number; height: number };
  ocr_text: string;
  ocr_confidence: number;
  area: number;
  error?: string;
}

// Keep legacy types for backward compatibility with existing components
export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExtractionSettings {
  min_area_percent: number;
  simplify_tolerance: number;
  color_clusters: number;
  morph_kernel_size: number;
  fill_holes: boolean;
  smooth_contours: boolean;
}

export interface GeoreferencePoint {
  image_x: number;
  image_y: number;
  geo_lng: number;
  geo_lat: number;
}

export interface BoundingBox {
  top_left_lat: number;
  top_left_lng: number;
  bottom_right_lat: number;
  bottom_right_lng: number;
}

export interface GeoJSONFeature {
  type: 'Feature';
  properties: {
    zone_id: string;
  };
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
}

export interface GeoJSON {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
  metadata?: {
    image_width: number;
    image_height: number;
    original_width: number;
    original_height: number;
    georeferenced: boolean;
    coordinate_system: string;
  };
}

export interface AppState {
  step: number;
  imageData: string | null;
  imageWidth: number;
  imageHeight: number;
  crop: CropArea | null;
  cropApplied: boolean;
  settings: ExtractionSettings;
  georefMode: 'none' | 'bbox' | 'points';
  boundingBox: BoundingBox | null;
  controlPoints: GeoreferencePoint[];
  geojson: GeoJSON | null;
  selectedFeatures: string[];
  retiredIds: string[];
  nextIdNumber: number;
  isProcessing: boolean;
  error: string | null;
}

export const defaultSettings: ExtractionSettings = {
  min_area_percent: 0.1,
  simplify_tolerance: 2.0,
  color_clusters: 32,
  morph_kernel_size: 3,
  fill_holes: true,
  smooth_contours: true,
};
