import { useCallback } from 'react';
import * as topojson from 'topojson-server';
import { GeoJSON } from '../types';

interface ExportPanelProps {
  geojson: GeoJSON;
  selectedFeatures: string[];
  onDelete: (zoneIds: string[]) => void;
  onMerge: (zoneIds: string[]) => void;
  retiredIds: string[];
}

function ExportPanel({
  geojson,
  selectedFeatures,
  onDelete,
  onMerge,
  retiredIds,
}: ExportPanelProps) {
  const downloadFile = useCallback((content: string, filename: string) => {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const handleExportGeoJSON = useCallback(() => {
    // Clean up metadata for export (keep only features and type)
    const exportData = {
      type: 'FeatureCollection',
      features: geojson.features.map((f) => ({
        type: 'Feature',
        properties: { zone_id: f.properties.zone_id },
        geometry: f.geometry,
      })),
    };
    downloadFile(JSON.stringify(exportData, null, 2), 'zones.geojson');
  }, [geojson, downloadFile]);

  const handleExportTopoJSON = useCallback(() => {
    const geoData = {
      type: 'FeatureCollection' as const,
      features: geojson.features.map((f) => ({
        type: 'Feature' as const,
        properties: { zone_id: f.properties.zone_id },
        geometry: f.geometry,
      })),
    };

    const topoData = topojson.topology({ zones: geoData });
    downloadFile(JSON.stringify(topoData, null, 2), 'zones.topojson');
  }, [geojson, downloadFile]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedFeatures.length > 0) {
      onDelete(selectedFeatures);
    }
  }, [selectedFeatures, onDelete]);

  const handleMergeSelected = useCallback(() => {
    if (selectedFeatures.length >= 2) {
      onMerge(selectedFeatures);
    }
  }, [selectedFeatures, onMerge]);

  return (
    <div className="step">
      <div className="step-header">
        <span className="step-number completed">5</span>
        <span className="step-title">Preview & Export</span>
      </div>
      <div className="step-content">
        <div className="polygon-count">
          {geojson.features.length} zones extracted
        </div>

        <div className="polygon-list">
          {geojson.features.slice(0, 50).map((feature) => (
            <div
              key={feature.properties.zone_id}
              className={`polygon-item ${
                selectedFeatures.includes(feature.properties.zone_id)
                  ? 'selected'
                  : ''
              }`}
            >
              <span>{feature.properties.zone_id}</span>
            </div>
          ))}
          {geojson.features.length > 50 && (
            <div style={{ textAlign: 'center', padding: '0.5rem', color: '#888' }}>
              ... and {geojson.features.length - 50} more
            </div>
          )}
        </div>

        {selectedFeatures.length > 0 && (
          <div className="export-options">
            <button
              className="btn btn-secondary"
              onClick={handleDeleteSelected}
            >
              Delete ({selectedFeatures.length})
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleMergeSelected}
              disabled={selectedFeatures.length < 2}
            >
              Merge ({selectedFeatures.length})
            </button>
          </div>
        )}

        {retiredIds.length > 0 && (
          <p className="help-text">
            {retiredIds.length} ID(s) retired: {retiredIds.slice(-3).join(', ')}
            {retiredIds.length > 3 ? '...' : ''}
          </p>
        )}

        <div className="export-options" style={{ marginTop: '0.5rem' }}>
          <button className="btn btn-primary" onClick={handleExportGeoJSON}>
            Export GeoJSON
          </button>
          <button className="btn btn-secondary" onClick={handleExportTopoJSON}>
            Export TopoJSON
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExportPanel;
