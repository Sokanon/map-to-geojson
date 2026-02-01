import { useEffect, useRef, useCallback, useState } from 'react';
import { useDigitizerStore } from '../stores/digitizerStore';
import { magicWandSelect } from '../api/digitizer';
import { Building } from '../types';

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
  const [editingBuildingId, setEditingBuildingId] = useState<number | null>(null);
  const [editingVertices, setEditingVertices] = useState<number[][]>([]);
  const [draggingVertex, setDraggingVertex] = useState<number | null>(null);

  // Building info dialog state
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [dialogPosition, setDialogPosition] = useState({ x: 0, y: 0 });
  const [dialogLabel, setDialogLabel] = useState('');

  // Hover state for cursor
  const [isHoveringBuilding, setIsHoveringBuilding] = useState(false);

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
    buildings,
    highlightedBuildingId,
    addLoadingBuilding,
    updateBuildingFromResponse,
    removeBuilding,
    updateBuilding,
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

    // Draw existing buildings
    buildings.forEach((building) => {
      const isHighlighted = building.id === highlightedBuildingId;
      const isEditing = building.id === editingBuildingId;

      if (isEditing) return; // Don't draw the original when editing

      ctx.beginPath();
      const ring = building.polygon[0];
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

      // Draw label at centroid (skip for loading buildings)
      if (!building.loading) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(building.label, building.centroid[0], building.centroid[1]);
      }
    });

    // Draw loading indicators at click positions
    buildings.forEach((building) => {
      if (building.loading && building.clickPosition) {
        const [cx, cy] = building.clickPosition;
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
    if (editingBuildingId !== null && editingVertices.length > 0) {
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
  }, [buildings, highlightedBuildingId, editingBuildingId, editingVertices, draggingVertex, pulsePhase]);

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
    setEditingBuildingId(null);
  }, [imageData]);

  // Animate pulse for loading indicators
  const hasLoadingBuildings = buildings.some(b => b.loading);
  useEffect(() => {
    if (!hasLoadingBuildings) return;
    const interval = setInterval(() => {
      setPulsePhase(p => (p + 1) % 60);
    }, 33); // ~30fps
    return () => clearInterval(interval);
  }, [hasLoadingBuildings]);

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

  // Find building at point
  const findBuildingAtPoint = useCallback((x: number, y: number): Building | null => {
    // Check buildings in reverse order (most recently added first, drawn on top)
    for (let i = buildings.length - 1; i >= 0; i--) {
      const building = buildings[i];
      if (building.loading) continue;
      const ring = building.polygon[0];
      if (ring && pointInPolygon(x, y, ring)) {
        return building;
      }
    }
    return null;
  }, [buildings]);

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
    if (e.button === 0 && editingBuildingId !== null) {
      const coords = getCanvasCoords(e);
      if (coords) {
        const vertexIndex = findVertexNear(coords.x, coords.y);
        if (vertexIndex >= 0) {
          setDraggingVertex(vertexIndex);
          e.preventDefault();
        }
      }
    }
  }, [offset, editingBuildingId, getCanvasCoords, findVertexNear]);

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

    // Check if hovering over a building (only when not editing)
    if (editingBuildingId === null) {
      const coords = getCanvasCoords(e);
      if (coords) {
        const hoveredBuilding = findBuildingAtPoint(coords.x, coords.y);
        setIsHoveringBuilding(hoveredBuilding !== null);
      }
    }
  }, [isPanning, draggingVertex, editingBuildingId, getCanvasCoords, findBuildingAtPoint]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setDraggingVertex(null);
  }, []);

  // Handle leaving the canvas
  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
    setDraggingVertex(null);
    setIsHoveringBuilding(false);
  }, []);

  // Prevent context menu
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // Handle click for magic wand selection or building selection
  const handleClick = useCallback(
    async (e: React.MouseEvent<HTMLCanvasElement>) => {
      // Skip if not left click, or if we're editing vertices
      if (e.button !== 0 || !imageData || editingBuildingId !== null) return;

      const coords = getCanvasCoords(e);
      if (!coords) return;

      // Don't trigger if clicking on a vertex handle area
      if (editingVertices.length > 0 && findVertexNear(coords.x, coords.y) >= 0) return;

      // Check if we clicked on an existing building
      const clickedBuilding = findBuildingAtPoint(coords.x, coords.y);
      if (clickedBuilding) {
        // Open dialog for this building
        setSelectedBuilding(clickedBuilding);
        setDialogLabel(clickedBuilding.label);
        setDialogPosition({ x: e.clientX, y: e.clientY });
        return;
      }

      // Add a loading building immediately with click position for visual feedback
      const buildingId = addLoadingBuilding(coords.x, coords.y);

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
          // Update the loading building with actual data
          updateBuildingFromResponse(buildingId, {
            label: response.ocr_text || `Building ${buildingId}`,
            polygon: response.polygon,
            centroid: response.centroid,
          });
        } else {
          // Remove the loading building if selection failed
          removeBuilding(buildingId);
          console.warn('Selection failed:', response.error);
        }
      } catch (error) {
        // Remove the loading building on error
        removeBuilding(buildingId);
        console.error('Magic wand error:', error);
      }
    },
    [imageData, useBoundaryMode, boundaryColor, boundaryTolerance, tolerance, ocrEngine, aiModel, editingBuildingId, editingVertices, getCanvasCoords, findVertexNear, findBuildingAtPoint, addLoadingBuilding, updateBuildingFromResponse, removeBuilding]
  );

  // Start editing a building
  const startEditing = useCallback((buildingId: number) => {
    const building = buildings.find(b => b.id === buildingId);
    if (building && building.polygon[0]) {
      // Remove closing point if present (same as first)
      const ring = building.polygon[0];
      const vertices = ring.slice(0, -1).map(v => [...v]);
      setEditingVertices(vertices);
      setEditingBuildingId(buildingId);
    }
  }, [buildings]);

  // Save edited polygon
  const saveEditing = useCallback(() => {
    if (editingBuildingId === null) return;

    // Close the polygon
    const closedVertices = [...editingVertices, editingVertices[0]];

    // Calculate new centroid
    const cx = editingVertices.reduce((sum, v) => sum + v[0], 0) / editingVertices.length;
    const cy = editingVertices.reduce((sum, v) => sum + v[1], 0) / editingVertices.length;

    updateBuilding(editingBuildingId, {
      polygon: [closedVertices],
      centroid: [cx, cy] as [number, number],
    });

    setEditingBuildingId(null);
    setEditingVertices([]);
  }, [editingBuildingId, editingVertices, updateBuilding]);

  // Cancel editing
  const cancelEditing = useCallback(() => {
    setEditingBuildingId(null);
    setEditingVertices([]);
  }, []);

  // Dialog handlers
  const handleDialogSave = useCallback(() => {
    if (selectedBuilding) {
      updateBuilding(selectedBuilding.id, { label: dialogLabel });
      setSelectedBuilding(null);
    }
  }, [selectedBuilding, dialogLabel, updateBuilding]);

  const handleDialogDelete = useCallback(() => {
    if (selectedBuilding) {
      removeBuilding(selectedBuilding.id);
      setSelectedBuilding(null);
    }
  }, [selectedBuilding, removeBuilding]);

  const handleDialogClose = useCallback(() => {
    setSelectedBuilding(null);
  }, []);

  const handleDialogEdit = useCallback(() => {
    if (selectedBuilding) {
      startEditing(selectedBuilding.id);
      setSelectedBuilding(null);
    }
  }, [selectedBuilding, startEditing]);

  // Focus on a building (pan and zoom to its centroid)
  const focusOnBuilding = useCallback((buildingId: number) => {
    const building = buildings.find(b => b.id === buildingId);
    if (!building || !canvasRef.current) return;

    const [cx, cy] = building.centroid;
    const canvas = canvasRef.current;

    // Zoom in to 2x (or keep current if higher)
    const newZoom = Math.max(zoom, 2);

    // Calculate offset to center the building's centroid
    const offsetX = (canvas.width / 2 - cx) * newZoom;
    const offsetY = (canvas.height / 2 - cy) * newZoom;

    setZoom(newZoom);
    setOffset({ x: offsetX, y: offsetY });
  }, [buildings, zoom]);

  // Expose edit functions via window for BuildingList to access
  useEffect(() => {
    (window as any).__canvasEditFns = { startEditing, saveEditing, cancelEditing, focusOnBuilding, editingBuildingId };
    return () => { delete (window as any).__canvasEditFns; };
  }, [startEditing, saveEditing, cancelEditing, focusOnBuilding, editingBuildingId]);

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

  if (!imageData) {
    return (
      <div className="empty-state">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
        <p>Upload an image to start</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="canvas-container"
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
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          cursor: isPanning ? 'grabbing' :
                 draggingVertex !== null ? 'grabbing' :
                 editingBuildingId !== null ? 'crosshair' :
                 isHoveringBuilding ? 'pointer' :
                 'crosshair',
        }}
      />

      {/* Edit mode toolbar */}
      {editingBuildingId !== null && (
        <div className="edit-toolbar">
          <span>Editing polygon - drag vertices to adjust</span>
          <div className="edit-toolbar-buttons">
            <button className="btn btn-primary" onClick={saveEditing}>Save</button>
            <button className="btn btn-secondary" onClick={cancelEditing}>Cancel</button>
          </div>
        </div>
      )}

      {/* Zoom controls */}
      <div className="zoom-controls">
        <button className="zoom-btn" onClick={handleZoomIn} title="Zoom in">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="11" y1="8" x2="11" y2="14" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </button>
        <span className="zoom-level">{Math.round(zoom * 100)}%</span>
        <button className="zoom-btn" onClick={handleZoomOut} title="Zoom out">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </button>
        <button className="zoom-btn" onClick={handleZoomReset} title="Reset view">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
      </div>

      {/* Help text */}
      <div className="canvas-help">
        Scroll to zoom | Middle-click drag to pan
      </div>

      {/* Building info dialog */}
      {selectedBuilding && (
        <>
          <div className="dialog-backdrop" onClick={handleDialogClose} />
          <div
            className="building-dialog"
            style={{
              left: Math.min(dialogPosition.x, window.innerWidth - 280),
              top: Math.min(dialogPosition.y, window.innerHeight - 200),
            }}
          >
            <div className="dialog-header">
              <span>Building #{selectedBuilding.id}</span>
              <button className="btn-icon" onClick={handleDialogClose}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="dialog-body">
              <div className="input-group">
                <label>Name</label>
                <input
                  type="text"
                  value={dialogLabel}
                  onChange={(e) => setDialogLabel(e.target.value)}
                  placeholder="Enter building name..."
                  autoFocus
                />
              </div>
            </div>
            <div className="dialog-footer">
              <button className="btn btn-sm btn-delete-outline" onClick={handleDialogDelete}>
                Delete
              </button>
              <div className="dialog-footer-right">
                <button className="btn btn-sm btn-secondary" onClick={handleDialogEdit}>
                  Edit Shape
                </button>
                <button className="btn btn-sm btn-primary" onClick={handleDialogSave}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default ImageCanvas;
