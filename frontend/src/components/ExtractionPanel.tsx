import { useCallback } from 'react';
import { ExtractionSettings } from '../types';

interface ExtractionPanelProps {
  settings: ExtractionSettings;
  onSettingsChange: (settings: ExtractionSettings) => void;
  onExtract: () => void;
  isProcessing: boolean;
  error: string | null;
}

function ExtractionPanel({
  settings,
  onSettingsChange,
  onExtract,
  isProcessing,
  error,
}: ExtractionPanelProps) {
  const handleChange = useCallback(
    (field: keyof ExtractionSettings, value: number | boolean) => {
      onSettingsChange({ ...settings, [field]: value });
    },
    [settings, onSettingsChange]
  );

  return (
    <div className="step">
      <div className="step-header">
        <span className="step-number active">4</span>
        <span className="step-title">Extraction Settings</span>
      </div>
      <div className="step-content">
        <div className="slider-group">
          <label>
            <span>Min Area (%)</span>
            <span>{settings.min_area_percent.toFixed(2)}%</span>
          </label>
          <input
            type="range"
            min="0.01"
            max="5"
            step="0.01"
            value={settings.min_area_percent}
            onChange={(e) =>
              handleChange('min_area_percent', parseFloat(e.target.value))
            }
          />
        </div>

        <div className="slider-group">
          <label>
            <span>Simplification</span>
            <span>{settings.simplify_tolerance.toFixed(1)}</span>
          </label>
          <input
            type="range"
            min="0"
            max="10"
            step="0.5"
            value={settings.simplify_tolerance}
            onChange={(e) =>
              handleChange('simplify_tolerance', parseFloat(e.target.value))
            }
          />
        </div>

        <div className="slider-group">
          <label>
            <span>Color Clusters</span>
            <span>{settings.color_clusters}</span>
          </label>
          <input
            type="range"
            min="8"
            max="64"
            step="4"
            value={settings.color_clusters}
            onChange={(e) =>
              handleChange('color_clusters', parseInt(e.target.value, 10))
            }
          />
        </div>

        <div className="checkbox-group">
          <input
            type="checkbox"
            id="fill_holes"
            checked={settings.fill_holes}
            onChange={(e) => handleChange('fill_holes', e.target.checked)}
          />
          <label htmlFor="fill_holes">Fill holes in polygons</label>
        </div>

        <div className="checkbox-group">
          <input
            type="checkbox"
            id="smooth_contours"
            checked={settings.smooth_contours}
            onChange={(e) => handleChange('smooth_contours', e.target.checked)}
          />
          <label htmlFor="smooth_contours">Smooth contours</label>
        </div>

        <button
          className="btn btn-primary btn-full"
          onClick={onExtract}
          disabled={isProcessing}
        >
          {isProcessing ? 'Processing...' : 'Extract Polygons'}
        </button>

        {error && (
          <div style={{ color: '#ef4444', fontSize: '0.75rem' }}>{error}</div>
        )}
      </div>
    </div>
  );
}

export default ExtractionPanel;
