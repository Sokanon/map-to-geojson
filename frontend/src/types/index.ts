// Smart Map Digitizer Types

export interface Unit {
  id: number;
  label: string;
  polygon: number[][][]; // GeoJSON polygon coordinates
  centroid: [number, number];
  loading?: boolean; // True while API call is in progress
  clickPosition?: [number, number]; // Where user clicked (for loading indicator)
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
