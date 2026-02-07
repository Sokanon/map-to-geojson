import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Upload, Folder, Trash2, SlidersHorizontal, X, Pencil, MousePointer2, Wand2, TextCursorInput } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useDigitizerStore } from '../stores/digitizerStore';
import { magicWandSelect } from '../api/digitizer';
import { Unit } from '../types';
import { getCollectionColor, getCollectionFillColor } from '../utils/collectionColors';
import Toolbar from './Toolbar';

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
  const [isBoxSelecting, setIsBoxSelecting] = useState(false);
  const [boxStart, setBoxStart] = useState<{ x: number; y: number } | null>(null);
  const [boxEnd, setBoxEnd] = useState<{ x: number; y: number } | null>(null);
  const [boxAdditive, setBoxAdditive] = useState(false);
  const [boxHasDragged, setBoxHasDragged] = useState(false);
  const suppressNextClickRef = useRef(false);
  const [activeTool, setActiveTool] = useState<'select' | 'wand'>('select');

  // Edit mode state
  const [editingUnitId, setEditingUnitId] = useState<number | null>(null);
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
    selectedUnitIds,
    selectedUnitOrder,
    getCollections,
    targetCollection,
    setTargetCollection,
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

  const collections = getCollections();
  const selectedCount = selectedUnitIds.size;
  const totalCount = units.filter((u) => !u.loading).length;
  const orderedSelectedIds = selectedUnitOrder.filter((id) => selectedUnitIds.has(id));
  const duplicateLabelSet = useMemo(() => {
    const counts = new Map<string, number>();
    for (const unit of units) {
      if (unit.loading) continue;
      const key = unit.label.trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const dupes = new Set<string>();
    for (const [key, count] of counts) {
      if (count > 1) dupes.add(key);
    }
    return dupes;
  }, [units]);

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
  }, [isPanning, draggingVertex, editingUnitId, getCanvasCoords, findUnitAtPoint, isBoxSelecting]);

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
  // Dialog handlers removed; selection now drives actions via the bottom bar.

  const handleBulkDeleteSelected = useCallback(() => {
    if (selectedCount === 0) return;
    setDeleteDialogOpen(true);
  }, [selectedCount, bulkDelete]);

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

  // Expose edit functions via window for UnitList to access
  useEffect(() => {
    (window as any).__canvasEditFns = { startEditing, saveEditing, cancelEditing, focusOnUnit, editingUnitId };
    return () => { delete (window as any).__canvasEditFns; };
  }, [startEditing, saveEditing, cancelEditing, focusOnUnit, editingUnitId]);

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
  }, [selectedUnitIds, selectNone, handleOpenRename]);

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
                 activeTool === 'select' ? 'default' :
                 activeTool === 'wand' ? 'cell' :
                 'crosshair',
        }}
      />

      {/* Floating action bar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40">
        <TooltipProvider delayDuration={200}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-2xl border border-white/10 bg-background/70 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
            <div className="flex items-center gap-1 pr-2 border-r border-white/10">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setActiveTool('select')}
                    className={cn(
                      "h-7 w-7 transition-colors",
                      activeTool === 'select' ? "bg-primary/15 text-primary" : "hover:bg-primary/10 hover:text-primary"
                    )}
                  >
                    <MousePointer2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Select</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setActiveTool('wand')}
                    className={cn(
                      "h-7 w-7 transition-colors",
                      activeTool === 'wand' ? "bg-primary/15 text-primary" : "hover:bg-primary/10 hover:text-primary"
                    )}
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Magic wand</TooltipContent>
              </Tooltip>
            </div>
          {selectedCount > 0 && (
            <div className="flex items-center gap-2 pr-2 border-r border-white/10">
              <span className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Selection</span>
              <span className="text-xs font-medium">
                {selectedCount}/{totalCount}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={selectNone}
                    className="h-7 w-7"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Clear selection</TooltipContent>
              </Tooltip>

              <DropdownMenu>
                <Tooltip>
                  <DropdownMenuTrigger asChild>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="h-7 w-7 hover:text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Folder className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                  </DropdownMenuTrigger>
                  <TooltipContent>Assign collection</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => handleBulkAssignCollection('__clear__')}>
                    Clear collection
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkAssignCollection('__new__')}>
                    New collection...
                  </DropdownMenuItem>
                  {collections.length > 0 && <DropdownMenuSeparator />}
                  {collections.map((c) => (
                    <DropdownMenuItem key={c} onClick={() => handleBulkAssignCollection(c)}>
                      <span className="flex items-center gap-2">
                        <Folder className="h-3.5 w-3.5" style={{ color: getCollectionColor(c) }} />
                        {c}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => orderedSelectedIds[0] && startEditing(orderedSelectedIds[0])}
                    className="h-7 w-7 hover:text-amber-500 hover:bg-amber-500/10 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit polygon</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleOpenRename}
                    className="h-7 w-7 hover:text-primary hover:bg-primary/10 transition-colors"
                  >
                    <TextCursorInput className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Rename</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleBulkDeleteSelected}
                    className="h-7 w-7 hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete selected</TooltipContent>
              </Tooltip>
            </div>
          )}

          <div className="flex items-center gap-2 pr-2 border-r border-white/10">
            <span className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">New items</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs px-2">
                  <Folder className="h-3 w-3" style={{ color: getCollectionColor(targetCollection || undefined) }} />
                  {targetCollection || 'Uncategorized'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setTargetCollection(null)}>
                  Uncategorized
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    const name = prompt('Enter new collection name:');
                    if (name?.trim()) setTargetCollection(name.trim());
                  }}
                >
                  New collection...
                </DropdownMenuItem>
                {collections.length > 0 && <DropdownMenuSeparator />}
                {collections.map((c) => (
                  <DropdownMenuItem key={c} onClick={() => setTargetCollection(c)}>
                    <span className="flex items-center gap-2">
                      <Folder className="h-3.5 w-3.5" style={{ color: getCollectionColor(c) }} />
                      {c}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-1 pr-2 border-r border-white/10">
            <Popover>
              <Tooltip>
                <PopoverTrigger asChild>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-sm" className="h-7 w-7">
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                </PopoverTrigger>
                <TooltipContent>Tools</TooltipContent>
              </Tooltip>
              <PopoverContent align="center" className="w-72 p-3">
                <Toolbar />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-center gap-1" />
          </div>
        </TooltipProvider>
      </div>

      {/* Edit mode toolbar */}
      {editingUnitId !== null && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-background/70 backdrop-blur-md px-4 py-3 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.25)] flex items-center gap-4 text-sm text-warning z-50 border border-white/10">
          <span>Editing polygon - drag vertices to adjust</span>
          <div className="flex gap-2">
            <Button size="sm" onClick={saveEditing}>Save</Button>
            <Button size="sm" variant="secondary" onClick={cancelEditing}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-background/70 backdrop-blur-md p-2 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.25)] border border-white/10">
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
      <div className="absolute bottom-4 left-4 text-[0.7rem] text-muted-foreground bg-background/70 backdrop-blur-md px-2.5 py-1.5 rounded-2xl border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.2)]">
        Scroll to zoom | Middle-click drag to pan
      </div>

      <Dialog open={renameSingleOpen} onOpenChange={setRenameSingleOpen}>
        <DialogContent
          className="sm:max-w-[420px] pointer-events-auto z-[60]"
          onPointerDownCapture={(e) => e.stopPropagation()}
          data-rename-dialog
        >
          <DialogHeader>
            <DialogTitle>Rename polygon</DialogTitle>
            <DialogDescription>
              Update the label for the selected polygon.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <label className="text-xs text-muted-foreground">Name</label>
            <input
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={renameSingleValue}
              onChange={(e) => setRenameSingleValue(e.target.value)}
              placeholder="Enter name"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRenameSingleOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenameSingleApply} disabled={!renameSingleValue.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent
          className="sm:max-w-[520px] pointer-events-auto z-[60]"
          onPointerDownCapture={(e) => e.stopPropagation()}
          data-rename-dialog
        >
          <DialogHeader>
            <DialogTitle>Smart rename</DialogTitle>
            <DialogDescription>
              Apply a sequence name in the order you selected polygons.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Prefix</label>
                <input
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={renamePrefix}
                  onChange={(e) => setRenamePrefix(e.target.value)}
                  placeholder="e.g. 19-"
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Starting number</label>
                <input
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={renameStartNumber}
                  onChange={(e) => setRenameStartNumber(e.target.value)}
                  placeholder="e.g. 002"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Direction</label>
                <select
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  value={renameDirection}
                  onChange={(e) => setRenameDirection(e.target.value as 'asc' | 'desc')}
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </div>
              {renameError && (
                <span className="text-[0.7rem] text-destructive col-span-3">{renameError}</span>
              )}
            </div>
            <div className="rounded-md border border-white/10 bg-background/50">
              <div className="px-3 py-2 text-[0.7rem] uppercase text-muted-foreground border-b border-white/10">
                Preview ({renamePreview.length})
              </div>
              <div className="max-h-48 overflow-y-auto custom-scrollbar">
                {renamePreview.length === 0 ? (
                  <div className="px-3 py-3 text-sm text-muted-foreground">No preview yet.</div>
                ) : (
                  renamePreview.map((r) => (
                    <div key={r.id} className="flex items-center justify-between px-3 py-2 text-sm border-b border-white/5 last:border-b-0">
                      <span className="truncate text-muted-foreground">{r.from || `#${r.id}`}</span>
                      <span className="ml-4 font-medium">{r.to}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkRenameSequence} disabled={!!renameError || renamePreview.length === 0}>
              Apply rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="pointer-events-auto z-[60]" onPointerDownCapture={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected polygons?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedCount} selected polygon{selectedCount === 1 ? '' : 's'}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                bulkDelete();
                setDeleteDialogOpen(false);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

export default ImageCanvas;
