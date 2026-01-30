import { useCallback } from 'react';
import { BoundingBox, GeoreferencePoint } from '../types';

interface GeoreferencePanelProps {
  mode: 'none' | 'bbox' | 'points';
  boundingBox: BoundingBox | null;
  controlPoints: GeoreferencePoint[];
  onModeChange: (mode: 'none' | 'bbox' | 'points') => void;
  onBoundingBoxChange: (bbox: BoundingBox | null) => void;
  onControlPointsChange: (points: GeoreferencePoint[]) => void;
}

function GeoreferencePanel({
  mode,
  boundingBox,
  controlPoints,
  onModeChange,
  onBoundingBoxChange,
}: GeoreferencePanelProps) {
  const handleBboxChange = useCallback(
    (field: keyof BoundingBox, value: string) => {
      const numValue = parseFloat(value) || 0;
      const newBbox: BoundingBox = boundingBox || {
        top_left_lat: 0,
        top_left_lng: 0,
        bottom_right_lat: 0,
        bottom_right_lng: 0,
      };
      onBoundingBoxChange({ ...newBbox, [field]: numValue });
    },
    [boundingBox, onBoundingBoxChange]
  );

  return (
    <div className="step">
      <div className="step-header">
        <span className="step-number active">3</span>
        <span className="step-title">Georeferencing (Optional)</span>
      </div>
      <div className="step-content">
        <div className="tabs">
          <button
            className={`tab ${mode === 'none' ? 'active' : ''}`}
            onClick={() => onModeChange('none')}
          >
            Skip
          </button>
          <button
            className={`tab ${mode === 'bbox' ? 'active' : ''}`}
            onClick={() => onModeChange('bbox')}
          >
            Bounding Box
          </button>
          <button
            className={`tab ${mode === 'points' ? 'active' : ''}`}
            onClick={() => onModeChange('points')}
            disabled
            title="Coming soon"
          >
            Control Points
          </button>
        </div>

        {mode === 'none' && (
          <p className="help-text">
            Polygons will be exported in pixel coordinates.
          </p>
        )}

        {mode === 'bbox' && (
          <>
            <p className="help-text">
              Enter the geographic coordinates of the map corners.
            </p>
            <div className="input-group">
              <label>Top-Left Corner</label>
              <div className="input-row">
                <input
                  type="number"
                  placeholder="Latitude"
                  step="0.0001"
                  value={boundingBox?.top_left_lat || ''}
                  onChange={(e) =>
                    handleBboxChange('top_left_lat', e.target.value)
                  }
                />
                <input
                  type="number"
                  placeholder="Longitude"
                  step="0.0001"
                  value={boundingBox?.top_left_lng || ''}
                  onChange={(e) =>
                    handleBboxChange('top_left_lng', e.target.value)
                  }
                />
              </div>
            </div>
            <div className="input-group">
              <label>Bottom-Right Corner</label>
              <div className="input-row">
                <input
                  type="number"
                  placeholder="Latitude"
                  step="0.0001"
                  value={boundingBox?.bottom_right_lat || ''}
                  onChange={(e) =>
                    handleBboxChange('bottom_right_lat', e.target.value)
                  }
                />
                <input
                  type="number"
                  placeholder="Longitude"
                  step="0.0001"
                  value={boundingBox?.bottom_right_lng || ''}
                  onChange={(e) =>
                    handleBboxChange('bottom_right_lng', e.target.value)
                  }
                />
              </div>
            </div>
          </>
        )}

        {mode === 'points' && (
          <>
            <p className="help-text">
              Click on the image to add control points, then click corresponding
              locations on the basemap.
            </p>
            <div className="georef-points">
              {controlPoints.length === 0 ? (
                <p style={{ color: '#666', textAlign: 'center' }}>
                  No points added yet
                </p>
              ) : (
                controlPoints.map((point, i) => (
                  <div key={i} className="georef-point">
                    <span>
                      Point {i + 1}: ({point.image_x.toFixed(0)},{' '}
                      {point.image_y.toFixed(0)})
                    </span>
                    <span>
                      ({point.geo_lat.toFixed(4)}, {point.geo_lng.toFixed(4)})
                    </span>
                  </div>
                ))
              )}
            </div>
            {controlPoints.length < 4 && (
              <span className="status-badge warning">
                Need {4 - controlPoints.length} more points
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default GeoreferencePanel;
