import { MagicWandResponse } from '../types';

const API_BASE = '/api';

// Convert hex color to RGB array
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16),
    ];
  }
  return [152, 152, 152]; // Default grey
}

export interface MagicWandOptions {
  useBoundaryMode: boolean;
  boundaryColor: string; // Hex color
  boundaryTolerance: number;
  tolerance: number;
  ocrEngine: 'tesseract' | 'ai';
  aiModel: string;
  existingPolygons?: number[][][][]; // Existing polygon coordinates to check for overlap
}

export async function magicWandSelect(
  imageData: string,
  clickX: number,
  clickY: number,
  options: MagicWandOptions
): Promise<MagicWandResponse> {
  const response = await fetch(`${API_BASE}/magic-wand`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image_data: imageData,
      click_x: Math.round(clickX),
      click_y: Math.round(clickY),
      use_boundary_mode: options.useBoundaryMode,
      boundary_color: hexToRgb(options.boundaryColor),
      boundary_tolerance: options.boundaryTolerance,
      tolerance: options.tolerance,
      simplify_tolerance: 2.0,
      ocr_engine: options.ocrEngine,
      ai_model: options.aiModel,
      existing_polygons: options.existingPolygons || null,
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

export async function checkHealth(): Promise<{ status: string; ocr_available: boolean }> {
  const response = await fetch(`${API_BASE}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }
  return response.json();
}
