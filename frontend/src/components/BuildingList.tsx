import { useCallback, useRef } from 'react';
import { LuRotateCcw, LuX, LuPencil, LuPlus } from 'react-icons/lu';
import * as topojson from 'topojson-client';
import { useDigitizerStore } from '../stores/digitizerStore';
import { Building } from '../types';

function BuildingList() {
  const {
    buildings,
    highlightedBuildingId,
    setHighlightedBuilding,
    removeBuilding,
    updateLabel,
    clearAll,
    importBuildings,
    imageData,
  } = useDigitizerStore();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleMouseEnter = useCallback(
    (id: number) => {
      setHighlightedBuilding(id);
    },
    [setHighlightedBuilding]
  );

  const handleMouseLeave = useCallback(() => {
    setHighlightedBuilding(null);
  }, [setHighlightedBuilding]);

  const handleDelete = useCallback(
    (e: React.MouseEvent, id: number) => {
      e.stopPropagation();
      removeBuilding(id);
    },
    [removeBuilding]
  );

  const handleEditPolygon = useCallback((e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    const fns = (window as any).__canvasEditFns;
    if (fns?.startEditing) {
      fns.startEditing(id);
    }
  }, []);

  const handleFocusBuilding = useCallback((id: number) => {
    const fns = (window as any).__canvasEditFns;
    if (fns?.focusOnBuilding) {
      fns.focusOnBuilding(id);
    }
  }, []);

  const handleLabelChange = useCallback((id: number, label: string) => {
    updateLabel(id, label);
  }, [updateLabel]);

  const handleClearAll = useCallback(() => {
    const completedCount = buildings.filter(b => !b.loading).length;
    if (completedCount > 0 && confirm(`Clear all ${completedCount} buildings?`)) {
      clearAll();
    }
  }, [buildings, clearAll]);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const importedBuildings: Building[] = [];

        if (json.type === 'FeatureCollection' && Array.isArray(json.features)) {
          for (const feature of json.features) {
            if (feature.geometry?.type === 'Polygon') {
              const coords = feature.geometry.coordinates;
              const ring = coords[0] || [];
              const cx = ring.reduce((sum: number, p: number[]) => sum + p[0], 0) / (ring.length || 1);
              const cy = ring.reduce((sum: number, p: number[]) => sum + p[1], 0) / (ring.length || 1);

              importedBuildings.push({
                id: 0,
                label: feature.properties?.building || feature.properties?.name || feature.properties?.label || '',
                polygon: coords,
                centroid: [cx, cy],
              });
            }
          }
        } else if (json.type === 'Topology') {
          // Convert TopoJSON to GeoJSON using topojson-client
          const objectKey = Object.keys(json.objects)[0];
          if (!objectKey) {
            alert('TopoJSON has no objects.');
            return;
          }
          const geojson = topojson.feature(json, json.objects[objectKey]) as any;

          if (geojson.type === 'FeatureCollection' && Array.isArray(geojson.features)) {
            for (const feature of geojson.features) {
              if (feature.geometry?.type === 'Polygon') {
                const coords = feature.geometry.coordinates;
                const ring = coords[0] || [];
                const cx = ring.reduce((sum: number, p: number[]) => sum + p[0], 0) / (ring.length || 1);
                const cy = ring.reduce((sum: number, p: number[]) => sum + p[1], 0) / (ring.length || 1);

                importedBuildings.push({
                  id: 0,
                  label: feature.properties?.building || feature.properties?.name || feature.properties?.label || '',
                  polygon: coords,
                  centroid: [cx, cy],
                });
              }
            }
          }
        }

        if (importedBuildings.length > 0) {
          importBuildings(importedBuildings);
        } else {
          alert('No valid polygon features found in file.');
        }
      } catch (err) {
        alert('Failed to parse JSON file.');
        console.error(err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [importBuildings]);

  const editingBuildingId = (window as any).__canvasEditFns?.editingBuildingId;

  // Sort buildings by ID descending (newest first)
  const sortedBuildings = [...buildings].sort((a, b) => b.id - a.id);
  const completedCount = buildings.filter(b => !b.loading).length;

  return (
    <div className="building-list">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.geojson,.topojson"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* Header - always visible */}
      <div className="building-list-header">
        <span>Buildings{completedCount > 0 ? ` (${completedCount})` : ''}</span>
        <div className="building-list-actions">
          <button
            className="btn-icon btn-import"
            onClick={handleImportClick}
            title="Import GeoJSON/TopoJSON"
            disabled={!imageData}
          >
            <LuPlus size={14} />
          </button>
          {completedCount > 0 && (
            <button
              className="btn-icon btn-reset"
              onClick={handleClearAll}
              title="Clear all buildings"
            >
              <LuRotateCcw size={14} />
            </button>
          )}
        </div>
      </div>

      {/* All buildings in descending order */}
      {sortedBuildings.length > 0 && (
        <div className="building-list-items">
          {sortedBuildings.map((building) => (
            <div
              key={building.id}
              className={`building-item ${
                building.loading ? 'loading' : ''
              } ${highlightedBuildingId === building.id ? 'highlighted' : ''} ${
                editingBuildingId === building.id ? 'editing' : ''
              }`}
              onMouseEnter={() => !building.loading && handleMouseEnter(building.id)}
              onMouseLeave={handleMouseLeave}
              onClick={() => !building.loading && handleFocusBuilding(building.id)}
            >
              <span className="building-id">#{building.id}</span>
              {building.loading ? (
                <>
                  <div className="building-loading-spinner" />
                  <span className="building-label loading-text">Loading...</span>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    className="building-name-input"
                    value={building.label}
                    onChange={(e) => handleLabelChange(building.id, e.target.value)}
                    placeholder="Enter name..."
                  />
                  <button
                    className="btn-icon btn-edit"
                    onClick={(e) => handleEditPolygon(e, building.id)}
                    title="Edit polygon"
                    disabled={editingBuildingId !== null}
                  >
                    <LuPencil size={14} />
                  </button>
                </>
              )}
              <button
                className="btn-icon btn-delete"
                onClick={(e) => handleDelete(e, building.id)}
                title={building.loading ? 'Cancel' : 'Delete building'}
              >
                <LuX size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {buildings.length === 0 && (
        <div className="building-list-empty">
          <p>No buildings added yet.</p>
          <p className="help-text">Click on the map to select regions.</p>
        </div>
      )}
    </div>
  );
}

export default BuildingList;
