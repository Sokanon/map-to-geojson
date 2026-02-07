import { useEffect, useRef, useCallback, useState, useMemo, forwardRef, useImperativeHandle } from 'react';
import { toast } from 'sonner';
import { useDigitizerStore } from '../stores/digitizerStore';
import { magicWandSelect } from '../api/digitizer';
import { Unit } from '../types';
import { getCollectionColor, getCollectionFillColor } from '../utils/collectionColors';
import { closeRing, getVerticesCentroid, pointInPolygon, stripClosingPoint } from '../utils/geometry';
import { getCollectionsFromUnits } from '../utils/collections';
import { useDuplicateLabels } from '../hooks/useDuplicateLabels';
import { loadImageSize, readFileAsDataUrl } from '../utils/file';
import CanvasActionBar from './CanvasActionBar';
import CanvasEditToolbar from './CanvasEditToolbar';
import CanvasZoomControls from './CanvasZoomControls';
import CanvasHelpHint from './CanvasHelpHint';
import CanvasRenameDialogs from './CanvasRenameDialogs';
import CanvasDeleteDialog from './CanvasDeleteDialog';
import CanvasEmptyState from './CanvasEmptyState';

export interface CanvasApi {
  focusOnUnit: (unitId: number) => void;
}

const ImageCanvas = forwardRef<CanvasApi>(function ImageCanvas(_props, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const [isBoxSelecting, setIsBoxSelecting] = useState(false);
  const [boxStart, setBoxStart] = useState<{ x: number; y: number } | null>(null);
  const [boxEnd, setBoxEnd] = useState<{ x: number; y: number } | null>(null);
  const [boxAdditive, setBoxAdditive] = useState(false);
  const [boxHasDragged, setBoxHasDragged] = useState(false);
  const suppressNextClickRef = useRef(false);
  const [activeTool, setActiveTool] = useState<'select' | 'wand'>('select');

  // Edit mode state
  const [editingVertices, setEditingVertices] = useState<number[][]>([]);
  const [draggingVertex, setDraggingVertex] = useState<number | null>(null);
  const [dragCoords, setDragCoords] = useState<{ x: number; y: number } | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameSingleOpen, setRenameSingleOpen] = useState(false);
  const [renameSingleValue, setRenameSingleValue] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [renamePrefix, setRenamePrefix] = useState('');
  const [renameStartNumber, setRenameStartNumber] = useState('1');
  const [renameDirection, setRenameDirection] = useState<'asc' | 'desc'>('asc');

  // Unit info dialog state (deprecated, kept empty for now)

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
    editingUnitId,
    selectedUnitIds,
    selectedUnitOrder,
    targetCollection,
    setTargetCollection,
    setEditingUnitId,
    setImage,
    addLoadingUnit,
    updateUnitFromResponse,
    removeUnit,
    updateUnit,
    selectUnit,
    selectNone,
    selectUnitsBatch,
    bulkDelete,
    bulkUpdateCollection,
    bulkRename,
  } = useDigitizerStore();

  const collections = useMemo(() => getCollectionsFromUnits(units), [units]);
  const selectedCount = selectedUnitIds.size;
  const totalCount = units.filter((u) => !u.loading).length;
  const orderedSelectedIds = selectedUnitOrder.filter((id) => selectedUnitIds.has(id));
  const duplicateLabelSet = useDuplicateLabels(units);

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
      const isSelected = selectedUnitIds.has(unit.id);
      const isEditing = unit.id === editingUnitId;
      const isDuplicateLabel = unit.label.trim().length > 0 && duplicateLabelSet.has(unit.label.trim());

      if (isEditing) return; // Don't draw the original when editing

      // Get collection-based colors
      const collectionColor = getCollectionColor(unit.collection);
      const fillColor = isHighlighted
        ? 'rgba(233, 69, 96, 0.5)'
        : getCollectionFillColor(unit.collection, 0.35);
      const strokeColor = isHighlighted ? '#e94560' : collectionColor;

      ctx.beginPath();
      const ring = unit.polygon[0];
      if (ring && ring.length > 0) {
        ctx.moveTo(ring[0][0], ring[0][1]);
        for (let i = 1; i < ring.length; i++) {
          ctx.lineTo(ring[i][0], ring[i][1]);
        }
        ctx.closePath();
      }
      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = isHighlighted ? 3 : 2;
      ctx.stroke();
      if (isSelected && !isHighlighted) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      if (isDuplicateLabel && !isHighlighted) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

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

    if (isBoxSelecting && boxStart && boxEnd) {
      const x = Math.min(boxStart.x, boxEnd.x);
      const y = Math.min(boxStart.y, boxEnd.y);
      const w = Math.abs(boxEnd.x - boxStart.x);
      const h = Math.abs(boxEnd.y - boxStart.y);
      ctx.save();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.9)';
      ctx.fillStyle = 'rgba(59, 130, 246, 0.12)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(x, y, w, h);
      ctx.fillRect(x, y, w, h);
      ctx.restore();
    }

    // Precision lens while dragging a vertex
    if (draggingVertex !== null && dragCoords && imageRef.current && canvasRef.current) {
      const lensSize = 140;
      const zoomFactor = 4;
      const srcSize = lensSize / zoomFactor;
      const halfSrc = srcSize / 2;
      const canvas = canvasRef.current;

      let destX = dragCoords.x + 20;
      let destY = dragCoords.y + 20;
      if (destX + lensSize > canvas.width) destX = dragCoords.x - lensSize - 20;
      if (destX < 0) destX = 8;
      if (destY + lensSize > canvas.height) destY = dragCoords.y - lensSize - 20;
      if (destY < 0) destY = 8;

      let srcX = dragCoords.x - halfSrc;
      let srcY = dragCoords.y - halfSrc;
      srcX = Math.max(0, Math.min(srcX, canvas.width - srcSize));
      srcY = Math.max(0, Math.min(srcY, canvas.height - srcSize));

      ctx.save();
      ctx.beginPath();
      ctx.rect(destX, destY, lensSize, lensSize);
      ctx.fillStyle = '#0b0b0b';
      ctx.fill();
      ctx.drawImage(
        imageRef.current,
        srcX,
        srcY,
        srcSize,
        srcSize,
        destX,
        destY,
        lensSize,
        lensSize
      );
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.strokeRect(destX, destY, lensSize, lensSize);

      const cx = destX + lensSize / 2;
      const cy = destY + lensSize / 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy);
      ctx.lineTo(cx + 10, cy);
      ctx.moveTo(cx, cy - 10);
      ctx.lineTo(cx, cy + 10);
      ctx.stroke();
      ctx.restore();
    }
  }, [units, highlightedUnitId, selectedUnitIds, duplicateLabelSet, editingUnitId, editingVertices, draggingVertex, dragCoords, pulsePhase, isBoxSelecting, boxStart, boxEnd]);

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
  }, [imageData, setEditingUnitId]);

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
    if (e.target instanceof Element && e.target.closest('[data-rename-dialog]')) {
      return;
    }
    // Middle mouse button (wheel click) for panning
    if (e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      panStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
      return;
    }

    if (e.button === 0 && activeTool === 'select' && editingUnitId === null) {
      const coords = getCanvasCoords(e);
      if (coords) {
        setIsBoxSelecting(true);
        setBoxStart(coords);
        setBoxEnd(coords);
        setBoxAdditive(e.shiftKey);
        setBoxHasDragged(false);
        e.preventDefault();
        return;
      }
    }

    // Left click while editing - check for vertex drag
    if (e.button === 0 && editingUnitId !== null) {
      const coords = getCanvasCoords(e);
      if (coords) {
        const vertexIndex = findVertexNear(coords.x, coords.y);
        if (vertexIndex >= 0) {
          setDraggingVertex(vertexIndex);
          setDragCoords(coords);
          e.preventDefault();
        }
      }
    }
  }, [offset, editingUnitId, getCanvasCoords, findVertexNear, activeTool]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setOffset({
        x: e.clientX - panStart.current.x,
        y: e.clientY - panStart.current.y,
      });
      return;
    }

    if (isBoxSelecting) {
      const coords = getCanvasCoords(e);
      if (coords) {
        setBoxEnd(coords);
        if (boxStart) {
          const dx = coords.x - boxStart.x;
          const dy = coords.y - boxStart.y;
          if (Math.hypot(dx, dy) > 6) {
            setBoxHasDragged(true);
          }
        }
      }
      return;
    }

    // Dragging vertex
    if (draggingVertex !== null) {
      const coords = getCanvasCoords(e);
      if (coords) {
        setDragCoords(coords);
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
  }, [isPanning, draggingVertex, editingUnitId, getCanvasCoords, findUnitAtPoint, isBoxSelecting, boxStart]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setDraggingVertex(null);
    setDragCoords(null);
    if (isBoxSelecting) {
      setIsBoxSelecting(false);
      if (boxStart && boxEnd && boxHasDragged) {
        const minX = Math.min(boxStart.x, boxEnd.x);
        const maxX = Math.max(boxStart.x, boxEnd.x);
        const minY = Math.min(boxStart.y, boxEnd.y);
        const maxY = Math.max(boxStart.y, boxEnd.y);
        const hits: Array<{ id: number; cx: number; cy: number }> = [];
        for (let i = units.length - 1; i >= 0; i--) {
          const u = units[i];
          if (u.loading) continue;
          const [cx, cy] = u.centroid;
          if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) {
            hits.push({ id: u.id, cx, cy });
          }
        }
        let ordered: number[] = [];
        if (hits.length > 0) {
          const dx = boxEnd.x - boxStart.x;
          const dy = boxEnd.y - boxStart.y;
          const mag = Math.hypot(dx, dy);
          if (mag > 0) {
            const ux = dx / mag;
            const uy = dy / mag;
            ordered = hits
              .sort((a, b) => (a.cx * ux + a.cy * uy) - (b.cx * ux + b.cy * uy))
              .map((h) => h.id);
          } else {
            ordered = hits.map((h) => h.id);
          }
        }
        if (ordered.length > 0) {
          selectUnitsBatch(ordered, !boxAdditive);
        }
        suppressNextClickRef.current = true;
      }
      setBoxStart(null);
      setBoxEnd(null);
      setBoxAdditive(false);
      setBoxHasDragged(false);
    }
  }, [isBoxSelecting, boxStart, boxEnd, units, selectUnitsBatch, boxAdditive, boxHasDragged]);

  // Handle leaving the canvas
  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
    setDraggingVertex(null);
    setDragCoords(null);
    setIsBoxSelecting(false);
    setBoxStart(null);
    setBoxEnd(null);
    setIsHoveringUnit(false);
    setBoxAdditive(false);
    setBoxHasDragged(false);
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
      if (e.target instanceof Element && e.target.closest('[data-rename-dialog]')) {
        return;
      }
      if (suppressNextClickRef.current) {
        suppressNextClickRef.current = false;
        return;
      }
      const coords = getCanvasCoords(e);
      if (!coords) return;

      // Don't trigger if clicking on a vertex handle area
      if (editingVertices.length > 0 && findVertexNear(coords.x, coords.y) >= 0) return;

      // Check if we clicked on an existing unit
      const clickedUnit = findUnitAtPoint(coords.x, coords.y);
      if (clickedUnit) {
        if (e.shiftKey) {
          selectUnit(clickedUnit.id);
        } else {
          selectUnitsBatch([clickedUnit.id], true);
        }
        return;
      }

      if (activeTool === 'select') return;

      // Add a loading unit immediately with click position for visual feedback
      const unitId = addLoadingUnit(coords.x, coords.y);

      try {
        // Collect existing polygons (only from non-loading units) to check for overlap
        const existingPolygons = units
          .filter(u => !u.loading && u.polygon)
          .map(u => u.polygon);

        const response = await magicWandSelect(imageData, coords.x, coords.y, {
          useBoundaryMode,
          boundaryColor,
          boundaryTolerance,
          tolerance,
          ocrEngine,
          aiModel,
          existingPolygons,
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
    [imageData, useBoundaryMode, boundaryColor, boundaryTolerance, tolerance, ocrEngine, aiModel, editingUnitId, editingVertices, getCanvasCoords, findVertexNear, findUnitAtPoint, addLoadingUnit, updateUnitFromResponse, removeUnit, selectUnit, selectUnitsBatch, units, activeTool]
  );

  // Sync editing vertices when editing target changes
  useEffect(() => {
    if (editingUnitId === null) {
      setEditingVertices([]);
      return;
    }
    const unit = units.find(u => u.id === editingUnitId);
    if (unit && unit.polygon[0]) {
      const ring = unit.polygon[0];
      const vertices = stripClosingPoint(ring).map(v => [...v]);
      setEditingVertices(vertices);
      return;
    }
    setEditingVertices([]);
  }, [editingUnitId, units]);

  // Save edited polygon
  const saveEditing = useCallback(() => {
    if (editingUnitId === null) return;

    if (editingVertices.length < 3) {
      toast.error('Polygon must have at least 3 points');
      return;
    }

    const unit = units.find(u => u.id === editingUnitId);
    const closedVertices = closeRing(editingVertices);
    const [cx, cy] = getVerticesCentroid(editingVertices);
    updateUnit(editingUnitId, {
      polygon: [closedVertices],
      centroid: [cx, cy] as [number, number],
    });

    setEditingUnitId(null);
    setEditingVertices([]);
    toast.success('Polygon updated', { description: unit?.label || `Unit #${editingUnitId}` });
  }, [editingUnitId, editingVertices, units, updateUnit, setEditingUnitId]);

  // Cancel editing
  const cancelEditing = useCallback(() => {
    setEditingUnitId(null);
    setEditingVertices([]);
  }, [setEditingUnitId]);

  // Dialog handlers
  // Dialog handlers removed; selection now drives actions via the bottom bar.

  const handleBulkDeleteSelected = useCallback(() => {
    if (selectedCount === 0) return;
    setDeleteDialogOpen(true);
  }, [selectedCount]);

  const handleBulkAssignCollection = useCallback((value: string) => {
    if (value === '__clear__') {
      bulkUpdateCollection(undefined);
      return;
    }
    if (value === '__new__') {
      const name = prompt('Enter new collection name:');
      if (name?.trim()) {
        bulkUpdateCollection(name.trim());
      }
      return;
    }
    bulkUpdateCollection(value);
  }, [bulkUpdateCollection]);

  const handleEditSelected = useCallback(() => {
    if (editingUnitId !== null) return;
    if (orderedSelectedIds.length === 0) return;
    setEditingUnitId(orderedSelectedIds[0]);
  }, [editingUnitId, orderedSelectedIds, setEditingUnitId]);

  const handleCreateTargetCollection = useCallback(() => {
    const name = prompt('Enter new collection name:');
    if (name?.trim()) setTargetCollection(name.trim());
  }, [setTargetCollection]);

  const renamePreview = useMemo(() => {
    if (orderedSelectedIds.length === 0) return [];
    const startNum = parseInt(renameStartNumber, 10);
    if (Number.isNaN(startNum)) return [];
    const width = Math.max(1, renameStartNumber.trim().length);
    return orderedSelectedIds.map((id, idx) => {
      const unit = units.find((u) => u.id === id);
      const offset = renameDirection === 'asc' ? idx : -idx;
      return {
        id,
        from: unit?.label || '',
        to: `${renamePrefix}${String(startNum + offset).padStart(width, '0')}`,
      };
    });
  }, [orderedSelectedIds, renamePrefix, renameStartNumber, renameDirection, units]);

  const renameError = useMemo(() => {
    if (!renameStartNumber.trim()) return 'Enter a starting number.';
    const startNum = parseInt(renameStartNumber, 10);
    if (Number.isNaN(startNum)) return 'Starting number must be numeric.';
    return null;
  }, [renameStartNumber]);

  const handleBulkRenameSequence = useCallback(() => {
    if (renameError || renamePreview.length === 0) return;
    const updates = renamePreview.map((r) => ({ id: r.id, label: r.to }));
    bulkRename(updates);
    setRenameDialogOpen(false);
  }, [renameError, renamePreview, bulkRename]);

  const handleOpenRename = useCallback(() => {
    if (selectedCount === 1) {
      const id = orderedSelectedIds[0];
      const unit = units.find((u) => u.id === id);
      setRenameSingleValue(unit?.label || '');
      setRenameSingleOpen(true);
      return;
    }
    if (selectedCount > 1) {
      setRenameDialogOpen(true);
    }
  }, [selectedCount, orderedSelectedIds, units]);

  const handleRenameSingleApply = useCallback(() => {
    if (selectedCount !== 1) return;
    const id = orderedSelectedIds[0];
    updateUnit(id, { label: renameSingleValue.trim() });
    setRenameSingleOpen(false);
  }, [selectedCount, orderedSelectedIds, renameSingleValue, updateUnit]);

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

  useImperativeHandle(ref, () => ({ focusOnUnit }), [focusOnUnit]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      const isTyping = active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA' || active?.isContentEditable;
      if (isTyping && e.key !== 'Escape') return;
      if (e.key === 'Escape') {
        if (selectedUnitIds.size > 0) {
          selectNone();
          return;
        }
      }
      if (e.key === 'F2') {
        if (selectedUnitIds.size > 0) {
          handleOpenRename();
          return;
        }
      }
      if (e.altKey && e.key === '1') {
        if (selectedUnitIds.size > 0) {
          handleOpenRename();
          return;
        }
      }
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (selectedUnitIds.size === 0) return;
      setDeleteDialogOpen(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedUnitIds, selectNone, handleOpenRename, setDeleteDialogOpen]);

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

  const processFile = useCallback((file: File) => {
    (async () => {
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const { width, height } = await loadImageSize(dataUrl);
        setImage(dataUrl, width, height);
      } catch (err) {
        toast.error('Failed to load image');
        console.error(err);
      }
    })();
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
      <CanvasEmptyState
        isDragging={isDragging}
        onClick={handleUploadClick}
        onDrop={handleFileDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onFileChange={handleFileInputChange}
        fileInputRef={fileInputRef}
      />
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
                 activeTool === 'select' ? 'default' :
                 activeTool === 'wand' ? 'cell' :
                 'crosshair',
        }}
      />

      <CanvasActionBar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        selectedCount={selectedCount}
        totalCount={totalCount}
        collections={collections}
        targetCollection={targetCollection}
        onTargetCollectionChange={setTargetCollection}
        onCreateTargetCollection={handleCreateTargetCollection}
        onAssignCollection={handleBulkAssignCollection}
        onClearSelection={selectNone}
        onEditSelected={handleEditSelected}
        onRenameSelected={handleOpenRename}
        onDeleteSelected={handleBulkDeleteSelected}
      />

      <CanvasEditToolbar
        isEditing={editingUnitId !== null}
        onSave={saveEditing}
        onCancel={cancelEditing}
      />

      <CanvasZoomControls
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onReset={handleZoomReset}
      />

      <CanvasHelpHint />

      <CanvasRenameDialogs
        renameSingleOpen={renameSingleOpen}
        onRenameSingleOpenChange={setRenameSingleOpen}
        renameSingleValue={renameSingleValue}
        onRenameSingleValueChange={setRenameSingleValue}
        onRenameSingleApply={handleRenameSingleApply}
        renameSequenceOpen={renameDialogOpen}
        onRenameSequenceOpenChange={setRenameDialogOpen}
        renamePrefix={renamePrefix}
        onRenamePrefixChange={setRenamePrefix}
        renameStartNumber={renameStartNumber}
        onRenameStartNumberChange={setRenameStartNumber}
        renameDirection={renameDirection}
        onRenameDirectionChange={setRenameDirection}
        renameError={renameError}
        renamePreview={renamePreview}
        onRenameSequenceApply={handleBulkRenameSequence}
      />

      <CanvasDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        selectedCount={selectedCount}
        onConfirm={() => {
          bulkDelete();
          setDeleteDialogOpen(false);
        }}
      />

    </div>
  );
});

ImageCanvas.displayName = 'ImageCanvas';

export default ImageCanvas;
