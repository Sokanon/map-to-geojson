import { useState, useCallback } from 'react';
import {
  AppState,
  CropArea,
  ExtractionSettings,
  BoundingBox,
  GeoreferencePoint,
  GeoJSON,
  GeoJSONFeature,
  defaultSettings,
} from './types';
import ImageUpload from './components/ImageUpload';
import CropTool from './components/CropTool';
import GeoreferencePanel from './components/GeoreferencePanel';
import ExtractionPanel from './components/ExtractionPanel';
import MapPreview from './components/MapPreview';
import ExportPanel from './components/ExportPanel';

const initialState: AppState = {
  step: 1,
  imageData: null,
  imageWidth: 0,
  imageHeight: 0,
  crop: null,
  cropApplied: false,
  settings: defaultSettings,
  georefMode: 'none',
  boundingBox: null,
  controlPoints: [],
  geojson: null,
  selectedFeatures: [],
  retiredIds: [],
  nextIdNumber: 1,
  isProcessing: false,
  error: null,
};

function App() {
  const [state, setState] = useState<AppState>(initialState);

  const updateState = useCallback((updates: Partial<AppState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleImageUpload = useCallback(
    (imageData: string, width: number, height: number) => {
      updateState({
        imageData,
        imageWidth: width,
        imageHeight: height,
        step: 2,
        crop: null,
        cropApplied: false,
        geojson: null,
        selectedFeatures: [],
        retiredIds: [],
        nextIdNumber: 1,
      });
    },
    [updateState]
  );

  const handleCropChange = useCallback(
    (crop: CropArea | null) => {
      updateState({ crop });
    },
    [updateState]
  );

  const handleCropApply = useCallback(() => {
    updateState({ cropApplied: true, step: 3 });
  }, [updateState]);

  const handleCropSkip = useCallback(() => {
    updateState({ cropApplied: false, crop: null, step: 3 });
  }, [updateState]);

  const handleSettingsChange = useCallback(
    (settings: ExtractionSettings) => {
      updateState({ settings });
    },
    [updateState]
  );

  const handleGeorefModeChange = useCallback(
    (mode: 'none' | 'bbox' | 'points') => {
      updateState({ georefMode: mode });
    },
    [updateState]
  );

  const handleBoundingBoxChange = useCallback(
    (bbox: BoundingBox | null) => {
      updateState({ boundingBox: bbox });
    },
    [updateState]
  );

  const handleControlPointsChange = useCallback(
    (points: GeoreferencePoint[]) => {
      updateState({ controlPoints: points });
    },
    [updateState]
  );

  const handleExtract = useCallback(async () => {
    if (!state.imageData) return;

    updateState({ isProcessing: true, error: null });

    try {
      const response = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_data: state.imageData,
          crop: state.cropApplied ? state.crop : null,
          settings: state.settings,
          control_points:
            state.georefMode === 'points' ? state.controlPoints : null,
          bounding_box: state.georefMode === 'bbox' ? state.boundingBox : null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Extraction failed');
      }

      const geojson: GeoJSON = await response.json();

      // Update next ID number based on extracted features
      const maxId = geojson.features.reduce((max, f) => {
        const num = parseInt(f.properties.zone_id.replace('ZONE_', ''), 10);
        return Math.max(max, num);
      }, 0);

      updateState({
        geojson,
        step: 4,
        isProcessing: false,
        nextIdNumber: maxId + 1,
      });
    } catch (err) {
      updateState({
        isProcessing: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [state, updateState]);

  const handleFeatureSelect = useCallback(
    (zoneId: string, multiSelect: boolean) => {
      setState((prev) => {
        if (multiSelect) {
          const isSelected = prev.selectedFeatures.includes(zoneId);
          return {
            ...prev,
            selectedFeatures: isSelected
              ? prev.selectedFeatures.filter((id) => id !== zoneId)
              : [...prev.selectedFeatures, zoneId],
          };
        }
        return {
          ...prev,
          selectedFeatures:
            prev.selectedFeatures.length === 1 &&
            prev.selectedFeatures[0] === zoneId
              ? []
              : [zoneId],
        };
      });
    },
    []
  );

  const handleFeatureDelete = useCallback(
    (zoneIds: string[]) => {
      if (!state.geojson) return;

      const newFeatures = state.geojson.features.filter(
        (f) => !zoneIds.includes(f.properties.zone_id)
      );

      updateState({
        geojson: { ...state.geojson, features: newFeatures },
        selectedFeatures: [],
        retiredIds: [...state.retiredIds, ...zoneIds],
      });
    },
    [state.geojson, state.retiredIds, updateState]
  );

  const handleFeatureMerge = useCallback(
    (zoneIds: string[]) => {
      if (!state.geojson || zoneIds.length < 2) return;

      // Get features to merge
      const toMerge = state.geojson.features.filter((f) =>
        zoneIds.includes(f.properties.zone_id)
      );

      if (toMerge.length < 2) return;

      // Simple merge: take union of all coordinates (simplified approach)
      // In a real app, you'd use turf.js or similar for proper polygon union
      const allCoords = toMerge.flatMap((f) => f.geometry.coordinates);
      const mergedGeometry = {
        type: 'Polygon' as const,
        coordinates: allCoords,
      };

      // Generate new ID
      const newZoneId = `ZONE_${state.nextIdNumber.toString().padStart(4, '0')}`;

      const newFeature: GeoJSONFeature = {
        type: 'Feature',
        properties: { zone_id: newZoneId },
        geometry: mergedGeometry,
      };

      const remainingFeatures = state.geojson.features.filter(
        (f) => !zoneIds.includes(f.properties.zone_id)
      );

      updateState({
        geojson: {
          ...state.geojson,
          features: [...remainingFeatures, newFeature],
        },
        selectedFeatures: [newZoneId],
        retiredIds: [...state.retiredIds, ...zoneIds],
        nextIdNumber: state.nextIdNumber + 1,
      });
    },
    [state.geojson, state.retiredIds, state.nextIdNumber, updateState]
  );

  const handleFeatureUpdate = useCallback(
    (zoneId: string, newGeometry: GeoJSONFeature['geometry']) => {
      if (!state.geojson) return;

      const newFeatures = state.geojson.features.map((f) =>
        f.properties.zone_id === zoneId ? { ...f, geometry: newGeometry } : f
      );

      updateState({
        geojson: { ...state.geojson, features: newFeatures },
      });
    },
    [state.geojson, updateState]
  );

  const handleNewPolygon = useCallback(
    (geometry: GeoJSONFeature['geometry']) => {
      if (!state.geojson) return;

      const newZoneId = `ZONE_${state.nextIdNumber.toString().padStart(4, '0')}`;

      const newFeature: GeoJSONFeature = {
        type: 'Feature',
        properties: { zone_id: newZoneId },
        geometry,
      };

      updateState({
        geojson: {
          ...state.geojson,
          features: [...state.geojson.features, newFeature],
        },
        nextIdNumber: state.nextIdNumber + 1,
      });
    },
    [state.geojson, state.nextIdNumber, updateState]
  );

  const handleReset = useCallback(() => {
    setState(initialState);
  }, []);

  return (
    <div className="app">
      <header className="header">
        <h1>Map to GeoJSON Converter</h1>
      </header>

      <main className="main">
        <aside className="sidebar">
          {/* Step 1: Upload */}
          <div className="step">
            <div className="step-header">
              <span
                className={`step-number ${state.step > 1 ? 'completed' : ''} ${
                  state.step === 1 ? 'active' : ''
                }`}
              >
                1
              </span>
              <span className="step-title">Upload Image</span>
            </div>
            <div className="step-content">
              <ImageUpload
                onUpload={handleImageUpload}
                disabled={state.isProcessing}
              />
              {state.imageData && (
                <span className="status-badge success">Image loaded</span>
              )}
            </div>
          </div>

          {/* Step 2: Crop */}
          {state.imageData && (
            <div className="step">
              <div className="step-header">
                <span
                  className={`step-number ${state.step > 2 ? 'completed' : ''} ${
                    state.step === 2 ? 'active' : ''
                  }`}
                >
                  2
                </span>
                <span className="step-title">Crop Map Area</span>
              </div>
              <div className="step-content">
                <p className="help-text">
                  Draw a rectangle to select the map area (exclude legend/margins)
                </p>
                <div className="export-options">
                  <button
                    className="btn btn-primary"
                    onClick={handleCropApply}
                    disabled={!state.crop || state.isProcessing}
                  >
                    Apply Crop
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={handleCropSkip}
                    disabled={state.isProcessing}
                  >
                    Skip
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Georeference & Extract */}
          {state.step >= 3 && (
            <>
              <GeoreferencePanel
                mode={state.georefMode}
                boundingBox={state.boundingBox}
                controlPoints={state.controlPoints}
                onModeChange={handleGeorefModeChange}
                onBoundingBoxChange={handleBoundingBoxChange}
                onControlPointsChange={handleControlPointsChange}
              />

              <ExtractionPanel
                settings={state.settings}
                onSettingsChange={handleSettingsChange}
                onExtract={handleExtract}
                isProcessing={state.isProcessing}
                error={state.error}
              />
            </>
          )}

          {/* Step 4: Preview & Export */}
          {state.geojson && (
            <ExportPanel
              geojson={state.geojson}
              selectedFeatures={state.selectedFeatures}
              onDelete={handleFeatureDelete}
              onMerge={handleFeatureMerge}
              retiredIds={state.retiredIds}
            />
          )}

          {/* Reset */}
          {state.imageData && (
            <button
              className="btn btn-secondary btn-full"
              onClick={handleReset}
              disabled={state.isProcessing}
            >
              Start Over
            </button>
          )}
        </aside>

        <div className="workspace">
          {!state.imageData && (
            <div className="empty-state">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p>Upload a map image to get started</p>
            </div>
          )}

          {state.imageData && state.step === 2 && (
            <CropTool
              imageData={state.imageData}
              crop={state.crop}
              onCropChange={handleCropChange}
            />
          )}

          {state.imageData && state.step >= 3 && !state.geojson && (
            <div className="image-preview">
              <img src={state.imageData} alt="Map" />
              {state.isProcessing && (
                <div className="loading-overlay">
                  <div className="spinner" />
                  <p>Extracting polygons...</p>
                </div>
              )}
            </div>
          )}

          {state.geojson && (
            <MapPreview
              geojson={state.geojson}
              selectedFeatures={state.selectedFeatures}
              onFeatureSelect={handleFeatureSelect}
              onFeatureDelete={handleFeatureDelete}
              onFeatureUpdate={handleFeatureUpdate}
              onNewPolygon={handleNewPolygon}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
