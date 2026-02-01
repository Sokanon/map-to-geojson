import { useCallback, useRef } from 'react';
import { RotateCcw, X, Pencil, Plus, MapPin } from 'lucide-react';
import * as topojson from 'topojson-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useDigitizerStore } from '../stores/digitizerStore';
import { Unit } from '../types';

function UnitList() {
  const {
    units,
    highlightedUnitId,
    setHighlightedUnit,
    removeUnit,
    updateLabel,
    clearAll,
    importUnits,
    imageData,
  } = useDigitizerStore();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleMouseEnter = useCallback(
    (id: number) => {
      setHighlightedUnit(id);
    },
    [setHighlightedUnit]
  );

  const handleMouseLeave = useCallback(() => {
    setHighlightedUnit(null);
  }, [setHighlightedUnit]);

  const handleDelete = useCallback(
    (e: React.MouseEvent, id: number) => {
      e.stopPropagation();
      removeUnit(id);
    },
    [removeUnit]
  );

  const handleEditPolygon = useCallback((e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    const fns = (window as any).__canvasEditFns;
    if (fns?.startEditing) {
      fns.startEditing(id);
    }
  }, []);

  const handleFocusUnit = useCallback((id: number) => {
    const fns = (window as any).__canvasEditFns;
    if (fns?.focusOnUnit) {
      fns.focusOnUnit(id);
    }
  }, []);

  const handleLabelChange = useCallback((id: number, label: string) => {
    updateLabel(id, label);
  }, [updateLabel]);

  const handleClearAll = useCallback(() => {
    const completedCount = units.filter(u => !u.loading).length;
    if (completedCount > 0 && confirm(`Clear all ${completedCount} units?`)) {
      clearAll();
    }
  }, [units, clearAll]);

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
        const importedUnits: Unit[] = [];

        if (json.type === 'FeatureCollection' && Array.isArray(json.features)) {
          for (const feature of json.features) {
            if (feature.geometry?.type === 'Polygon') {
              const coords = feature.geometry.coordinates;
              const ring = coords[0] || [];
              const cx = ring.reduce((sum: number, p: number[]) => sum + p[0], 0) / (ring.length || 1);
              const cy = ring.reduce((sum: number, p: number[]) => sum + p[1], 0) / (ring.length || 1);

              importedUnits.push({
                id: 0,
                label: feature.properties?.name || feature.properties?.unit || feature.properties?.building || feature.properties?.label || '',
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

                importedUnits.push({
                  id: 0,
                  label: feature.properties?.name || feature.properties?.unit || feature.properties?.building || feature.properties?.label || '',
                  polygon: coords,
                  centroid: [cx, cy],
                });
              }
            }
          }
        }

        if (importedUnits.length > 0) {
          importUnits(importedUnits);
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
  }, [importUnits]);

  const editingUnitId = (window as any).__canvasEditFns?.editingUnitId;

  // Sort units by ID descending (newest first)
  const sortedUnits = [...units].sort((a, b) => b.id - a.id);
  const completedCount = units.filter(u => !u.loading).length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.geojson,.topojson"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Header - always visible */}
      <div className="flex items-center justify-between text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-2 flex-shrink-0">
        <span>Units{completedCount > 0 ? ` (${completedCount})` : ''}</span>
        <div className="flex gap-1">
          <Button
            variant="ghost-subtle"
            size="icon-sm"
            onClick={handleImportClick}
            title="Import GeoJSON/TopoJSON"
            disabled={!imageData}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          {completedCount > 0 && (
            <Button
              variant="ghost-destructive"
              size="icon-sm"
              onClick={handleClearAll}
              title="Clear all units"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* All units in descending order */}
      {sortedUnits.length > 0 && (
        <div className="flex-1 overflow-y-auto flex flex-col gap-1 min-h-0 custom-scrollbar">
          {sortedUnits.map((unit) => (
            <div
              key={unit.id}
              className={cn(
                "flex items-center gap-2 p-2 bg-background rounded-lg border border-transparent",
                unit.loading && "bg-primary/10 border-primary/30",
                highlightedUnitId === unit.id && "bg-primary/20 border-primary",
                editingUnitId === unit.id && "bg-warning/20 border-warning"
              )}
              onMouseEnter={() => !unit.loading && handleMouseEnter(unit.id)}
              onMouseLeave={handleMouseLeave}
            >
              <span className="text-[0.7rem] text-muted-foreground font-semibold min-w-7">#{unit.id}</span>
              {unit.loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-border border-t-primary rounded-full animate-spin flex-shrink-0" />
                  <span className="text-muted-foreground text-sm flex-1">Loading...</span>
                </>
              ) : (
                <>
                  <Input
                    type="text"
                    className="flex-1 min-w-0 h-auto py-1 px-2 text-sm bg-transparent border-transparent hover:border-border hover:bg-background focus:border-primary focus:bg-background"
                    value={unit.label}
                    onChange={(e) => handleLabelChange(unit.id, e.target.value)}
                    placeholder="Enter name..."
                  />
                  <Button
                    variant="ghost-primary"
                    size="icon-sm"
                    onClick={() => handleFocusUnit(unit.id)}
                    title="Go to unit"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost-warning"
                    size="icon-sm"
                    onClick={(e) => handleEditPolygon(e, unit.id)}
                    title="Edit polygon"
                    disabled={editingUnitId !== null}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
              <Button
                variant="ghost-destructive"
                size="icon-sm"
                onClick={(e) => handleDelete(e, unit.id)}
                title={unit.loading ? 'Cancel' : 'Delete unit'}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {units.length === 0 && (
        <div className="text-center text-muted-foreground text-sm py-4">
          <p>No units added yet.</p>
          <p className="text-xs italic mt-2">Click on the map to select regions.</p>
        </div>
      )}
    </div>
  );
}

export default UnitList;
