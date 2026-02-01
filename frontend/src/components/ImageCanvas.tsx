import { useEffect, useRef, useCallback, useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useDigitizerStore } from '../stores/digitizerStore';
import { magicWandSelect } from '../api/digitizer';
import { Unit } from '../types';

// Point-in-polygon test using ray casting algorithm
function pointInPolygon(x: number, y: number, polygon: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

function ImageCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });

  // Edit mode state
  const [editingUnitId, setEditingUnitId] = useState<number | null>(null);
  const [editingVertices, setEditingVertices] = useState<number[][]>([]);
  const [draggingVertex, setDraggingVertex] = useState<number | null>(null);

  // Unit info dialog state
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [dialogLabel, setDialogLabel] = useState('');

  // Hover state for cursor
  const [isHoveringUnit, setIsHoveringUnit] = useState(false);

  // Pulse animation for loading indicators
  const [pulsePhase, setPulsePhase] = useState(0);

  const {
    imageData,
    useBoundaryMode,
    boundaryColor,
    boundaryTolerance,
    tolerance,
    ocrEngine,
    aiModel,
    units,
    highlightedUnitId,
    addLoadingUnit,
    updateUnitFromResponse,
    removeUnit,
    updateUnit,
  } = useDigitizerStore();

  // Draw the canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !imageRef.current) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw image
    ctx.drawImage(imageRef.current, 0, 0);

    // Draw existing units
    units.forEach((unit) => {
      const isHighlighted = unit.id === highlightedUnitId;
      const isEditing = unit.id === editingUnitId;

      if (isEditing) return; // Don't draw the original when editing

      ctx.beginPath();
      const ring = unit.polygon[0];
      if (ring && ring.length > 0) {
        ctx.moveTo(ring[0][0], ring[0][1]);
        for (let i = 1; i < ring.length; i++) {
          ctx.lineTo(ring[i][0], ring[i][1]);
        }
        ctx.closePath();
      }
      ctx.fillStyle = isHighlighted
        ? 'rgba(233, 69, 96, 0.5)'
        : 'rgba(74, 222, 128, 0.3)';
      ctx.fill();
      ctx.strokeStyle = isHighlighted ? '#e94560' : '#4ade80';
      ctx.lineWidth = isHighlighted ? 3 : 2;
      ctx.stroke();

      // Draw label at centroid (skip for loading units)
      if (!unit.loading) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(unit.label, unit.centroid[0], unit.centroid[1]);
      }
    });

    // Draw loading indicators at click positions
    units.forEach((unit) => {
      if (unit.loading && unit.clickPosition) {
        const [cx, cy] = unit.clickPosition;
        const pulse = Math.sin(pulsePhase * 0.15) * 0.5 + 0.5; // 0 to 1
        const radius = 8 + pulse * 12; // 8 to 20px
        const alpha = 0.8 - pulse * 0.4; // 0.8 to 0.4

        // Outer pulsing ring
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(74, 222, 128, ${alpha})`;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Inner solid dot
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#4ade80';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

    // Draw editing polygon with vertex handles
    if (editingUnitId !== null && editingVertices.length > 0) {
      ctx.beginPath();
      ctx.moveTo(editingVertices[0][0], editingVertices[0][1]);
      for (let i = 1; i < editingVertices.length; i++) {
        ctx.lineTo(editingVertices[i][0], editingVertices[i][1]);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(251, 191, 36, 0.4)';
      ctx.fill();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw vertex handles
      editingVertices.forEach((vertex, i) => {
        ctx.beginPath();
        ctx.arc(vertex[0], vertex[1], 6, 0, Math.PI * 2);
        ctx.fillStyle = i === draggingVertex ? '#e94560' : '#fbbf24';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }
  }, [units, highlightedUnitId, editingUnitId, editingVertices, draggingVertex, pulsePhase]);

  // Load image and setup canvas
  useEffect(() => {
    if (!imageData) return;

    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = img.width;
        canvas.height = img.height;
        draw();
      }
    };
    img.src = imageData;
  }, [imageData, draw]);

  // Redraw when state changes
  useEffect(() => {
    draw();
  }, [draw]);

  // Reset zoom/pan when image changes
  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setEditingUnitId(null);
  }, [imageData]);

  // Animate pulse for loading indicators
  const hasLoadingUnits = units.some(u => u.loading);
  useEffect(() => {
    if (!hasLoadingUnits) return;
    const interval = setInterval(() => {
      setPulsePhase(p => (p + 1) % 60);
    }, 33); // ~30fps
    return () => clearInterval(interval);
  }, [hasLoadingUnits]);

  // Handle mouse wheel zoom - always zoom, no modifier needed
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((prev) => Math.min(Math.max(prev * delta, 0.25), 5));
  }, []);

  // Get canvas coordinates from mouse event
  const getCanvasCoords = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  // Find vertex near point
  const findVertexNear = useCallback((x: number, y: number, threshold: number = 10) => {
    const canvas = canvasRef.current;
    if (!canvas) return -1;

    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    const adjustedThreshold = threshold * scale / zoom;

    for (let i = 0; i < editingVertices.length; i++) {
      const dx = editingVertices[i][0] - x;
      const dy = editingVertices[i][1] - y;
      if (Math.sqrt(dx * dx + dy * dy) < adjustedThreshold) {
        return i;
      }
    }
    return -1;
  }, [editingVertices, zoom]);

  // Find unit at point
  const findUnitAtPoint = useCallback((x: number, y: number): Unit | null => {
    // Check units in reverse order (most recently added first, drawn on top)
    for (let i = units.length - 1; i >= 0; i--) {
      const unit = units[i];
      if (unit.loading) continue;
      const ring = unit.polygon[0];
      if (ring && pointInPolygon(x, y, ring)) {
        return unit;
      }
    }
    return null;
  }, [units]);

  // Handle mouse down
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Middle mouse button (wheel click) for panning
    if (e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      panStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
      return;
    }

    // Left click while editing - check for vertex drag
    if (e.button === 0 && editingUnitId !== null) {
      const coords = getCanvasCoords(e);
      if (coords) {
        const vertexIndex = findVertexNear(coords.x, coords.y);
        if (vertexIndex >= 0) {
          setDraggingVertex(vertexIndex);
          e.preventDefault();
        }
      }
    }
  }, [offset, editingUnitId, getCanvasCoords, findVertexNear]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setOffset({
        x: e.clientX - panStart.current.x,
        y: e.clientY - panStart.current.y,
      });
      return;
    }

    // Dragging vertex
    if (draggingVertex !== null) {
      const coords = getCanvasCoords(e);
      if (coords) {
        setEditingVertices(prev => {
          const newVertices = [...prev];
          newVertices[draggingVertex] = [coords.x, coords.y];
          return newVertices;
        });
      }
      return;
    }

    // Check if hovering over a unit (only when not editing)
    if (editingUnitId === null) {
      const coords = getCanvasCoords(e);
      if (coords) {
        const hoveredUnit = findUnitAtPoint(coords.x, coords.y);
        setIsHoveringUnit(hoveredUnit !== null);
      }
    }
  }, [isPanning, draggingVertex, editingUnitId, getCanvasCoords, findUnitAtPoint]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setDraggingVertex(null);
  }, []);

  // Handle leaving the canvas
  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
    setDraggingVertex(null);
    setIsHoveringUnit(false);
  }, []);

  // Prevent context menu
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // Handle click for magic wand selection or unit selection
  const handleClick = useCallback(
    async (e: React.MouseEvent<HTMLCanvasElement>) => {
      // Skip if not left click, or if we're editing vertices
      if (e.button !== 0 || !imageData || editingUnitId !== null) return;

      const coords = getCanvasCoords(e);
      if (!coords) return;

      // Don't trigger if clicking on a vertex handle area
      if (editingVertices.length > 0 && findVertexNear(coords.x, coords.y) >= 0) return;

      // Check if we clicked on an existing unit
      const clickedUnit = findUnitAtPoint(coords.x, coords.y);
      if (clickedUnit) {
        // Open dialog for this unit
        setSelectedUnit(clickedUnit);
        setDialogLabel(clickedUnit.label);
        return;
      }

      // Add a loading unit immediately with click position for visual feedback
      const unitId = addLoadingUnit(coords.x, coords.y);

      try {
        const response = await magicWandSelect(imageData, coords.x, coords.y, {
          useBoundaryMode,
          boundaryColor,
          boundaryTolerance,
          tolerance,
          ocrEngine,
          aiModel,
        });

        if (response.success && response.polygon && response.centroid && response.bbox) {
          // Update the loading unit with actual data
          const label = response.ocr_text || `Unit ${unitId}`;
          updateUnitFromResponse(unitId, {
            label,
            polygon: response.polygon,
            centroid: response.centroid,
          });
          toast.success('Unit added', { description: label });
        } else {
          // Remove the loading unit if selection failed
          removeUnit(unitId);
          toast.error('Selection failed', { description: response.error || 'No region found at this location' });
        }
      } catch (error) {
        // Remove the loading unit on error
        removeUnit(unitId);
        toast.error('Selection failed', { description: 'Could not connect to the server' });
        console.error('Magic wand error:', error);
      }
    },
    [imageData, useBoundaryMode, boundaryColor, boundaryTolerance, tolerance, ocrEngine, aiModel, editingUnitId, editingVertices, getCanvasCoords, findVertexNear, findUnitAtPoint, addLoadingUnit, updateUnitFromResponse, removeUnit]
  );

  // Start editing a unit
  const startEditing = useCallback((unitId: number) => {
    const unit = units.find(u => u.id === unitId);
    if (unit && unit.polygon[0]) {
      // Remove closing point if present (same as first)
      const ring = unit.polygon[0];
      const vertices = ring.slice(0, -1).map(v => [...v]);
      setEditingVertices(vertices);
      setEditingUnitId(unitId);
    }
  }, [units]);

  // Save edited polygon
  const saveEditing = useCallback(() => {
    if (editingUnitId === null) return;

    // Close the polygon
    const closedVertices = [...editingVertices, editingVertices[0]];

    // Calculate new centroid
    const cx = editingVertices.reduce((sum, v) => sum + v[0], 0) / editingVertices.length;
    const cy = editingVertices.reduce((sum, v) => sum + v[1], 0) / editingVertices.length;

    const unit = units.find(u => u.id === editingUnitId);
    updateUnit(editingUnitId, {
      polygon: [closedVertices],
      centroid: [cx, cy] as [number, number],
    });

    setEditingUnitId(null);
    setEditingVertices([]);
    toast.success('Polygon updated', { description: unit?.label || `Unit #${editingUnitId}` });
  }, [editingUnitId, editingVertices, units, updateUnit]);

  // Cancel editing
  const cancelEditing = useCallback(() => {
    setEditingUnitId(null);
    setEditingVertices([]);
  }, []);

  // Dialog handlers
  const handleDialogSave = useCallback(() => {
    if (selectedUnit) {
      updateUnit(selectedUnit.id, { label: dialogLabel });
      setSelectedUnit(null);
    }
  }, [selectedUnit, dialogLabel, updateUnit]);

  const handleDialogDelete = useCallback(() => {
    if (selectedUnit) {
      const label = selectedUnit.label || `Unit #${selectedUnit.id}`;
      removeUnit(selectedUnit.id);
      setSelectedUnit(null);
      toast.success('Unit deleted', { description: label });
    }
  }, [selectedUnit, removeUnit]);

  const handleDialogClose = useCallback(() => {
    setSelectedUnit(null);
  }, []);

  const handleDialogEdit = useCallback(() => {
    if (selectedUnit) {
      startEditing(selectedUnit.id);
      setSelectedUnit(null);
    }
  }, [selectedUnit, startEditing]);

  // Focus on a unit (pan and zoom to its centroid)
  const focusOnUnit = useCallback((unitId: number) => {
    const unit = units.find(u => u.id === unitId);
    if (!unit || !canvasRef.current) return;

    const [cx, cy] = unit.centroid;
    const canvas = canvasRef.current;

    // Zoom in to 2x (or keep current if higher)
    const newZoom = Math.max(zoom, 2);

    // Calculate offset to center the unit's centroid
    const offsetX = (canvas.width / 2 - cx) * newZoom;
    const offsetY = (canvas.height / 2 - cy) * newZoom;

    setZoom(newZoom);
    setOffset({ x: offsetX, y: offsetY });
  }, [units, zoom]);

  // Expose edit functions via window for UnitList to access
  useEffect(() => {
    (window as any).__canvasEditFns = { startEditing, saveEditing, cancelEditing, focusOnUnit, editingUnitId };
    return () => { delete (window as any).__canvasEditFns; };
  }, [startEditing, saveEditing, cancelEditing, focusOnUnit, editingUnitId]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev * 1.25, 5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev * 0.8, 0.25));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  // Upload state for drag and drop
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { setImage } = useDigitizerStore();

  const processFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        setImage(result, img.width, img.height);
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  }, [setImage]);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processFile(file);
    }
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  if (!imageData) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center h-full w-full text-muted-foreground gap-6 cursor-pointer transition-all",
          isDragging && "bg-primary/10"
        )}
        onClick={handleUploadClick}
        onDrop={handleFileDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className={cn(
          "flex flex-col items-center gap-4 p-12 rounded-xl border-2 border-dashed transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-border"
        )}>
          <Upload className={cn("w-16 h-16 transition-colors", isDragging ? "text-primary" : "text-muted-foreground/50")} />
          <div className="text-center">
            <p className="text-lg font-medium text-foreground">Drop your map image here</p>
            <p className="text-sm mt-1">or click to browse</p>
            <p className="text-xs mt-3 text-muted-foreground/70">Supports PNG, JPG</p>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/png,image/jpeg,image/jpg"
          onChange={handleFileInputChange}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex items-center justify-center overflow-hidden p-4"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onContextMenu={handleContextMenu}
    >
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        className="canvas-shadow rounded-lg transition-transform duration-100"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          cursor: isPanning ? 'grabbing' :
                 draggingVertex !== null ? 'grabbing' :
                 editingUnitId !== null ? 'crosshair' :
                 isHoveringUnit ? 'pointer' :
                 'crosshair',
        }}
      />

      {/* Edit mode toolbar */}
      {editingUnitId !== null && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-card px-4 py-3 rounded-lg shadow-lg flex items-center gap-4 text-sm text-warning z-50 border border-border">
          <span>Editing polygon - drag vertices to adjust</span>
          <div className="flex gap-2">
            <Button size="sm" onClick={saveEditing}>Save</Button>
            <Button size="sm" variant="secondary" onClick={cancelEditing}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-card p-2 rounded-lg shadow-lg border border-border">
        <Button
          variant="secondary"
          size="icon"
          className="h-8 w-8"
          onClick={handleZoomIn}
          title="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground min-w-10 text-center">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          variant="secondary"
          size="icon"
          className="h-8 w-8"
          onClick={handleZoomOut}
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-8 w-8"
          onClick={handleZoomReset}
          title="Reset view"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {/* Help text */}
      <div className="absolute bottom-4 left-4 text-[0.7rem] text-muted-foreground bg-card px-2.5 py-1.5 rounded-lg border border-border">
        Scroll to zoom | Middle-click drag to pan
      </div>

      {/* Unit info dialog */}
      <Dialog open={!!selectedUnit} onOpenChange={(open) => !open && handleDialogClose()}>
        <DialogContent className="sm:max-w-[320px]">
          <DialogHeader>
            <DialogTitle>Unit #{selectedUnit?.id}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="unitName">Name</Label>
              <Input
                id="unitName"
                value={dialogLabel}
                onChange={(e) => setDialogLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDialogSave()}
                placeholder="Enter unit name..."
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="flex-row justify-between sm:justify-between">
            <Button variant="destructive" onClick={handleDialogDelete}>
              Delete
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleDialogEdit}>
                Edit Shape
              </Button>
              <Button onClick={handleDialogSave}>
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ImageCanvas;
