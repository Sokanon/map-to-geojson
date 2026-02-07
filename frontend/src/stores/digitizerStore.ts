import { create } from 'zustand';
import { Unit } from '../types';

interface DigitizerState {
  imageData: string | null;
  imageWidth: number;
  imageHeight: number;
  useBoundaryMode: boolean; // true = use boundary color, false = use tolerance
  boundaryColor: string; // Hex color like "#989898"
  boundaryTolerance: number;
  tolerance: number; // For non-boundary mode
  ocrEngine: 'tesseract' | 'ai';
  aiModel: string;
  units: Unit[];
  nextId: number;
  highlightedUnitId: number | null;
  // Selection state
  selectedUnitIds: Set<number>;
  lastSelectedId: number | null;
  selectedUnitOrder: number[];
  // Filter state
  collectionFilter: string | null; // null = all, '' = uncategorized, string = filter by collection
  // Target collection for new items
  targetCollection: string | null; // null = uncategorized, string = collection name
}

interface DigitizerActions {
  setImage: (imageData: string, width: number, height: number) => void;
  setUseBoundaryMode: (use: boolean) => void;
  setBoundaryColor: (color: string) => void;
  setBoundaryTolerance: (tolerance: number) => void;
  setTolerance: (tolerance: number) => void;
  setOcrEngine: (engine: 'tesseract' | 'ai') => void;
  setAiModel: (model: string) => void;
  addLoadingUnit: (clickX: number, clickY: number) => number;
  updateUnitFromResponse: (id: number, data: {
    label: string;
    polygon: number[][][];
    centroid: [number, number];
  }) => void;
  removeUnit: (id: number) => void;
  updateUnit: (id: number, updates: Partial<Unit>) => void;
  updateLabel: (id: number, label: string) => void;
  updateCollection: (id: number, collection: string | undefined) => void;
  getCollections: () => string[];
  setHighlightedUnit: (id: number | null) => void;
  importUnits: (units: Unit[]) => void;
  clearAll: () => void;
  reset: () => void;
  // Selection actions
  selectUnit: (id: number) => void;
  selectUnitRange: (id: number) => void;
  selectAll: () => void;
  selectNone: () => void;
  selectUnitsBatch: (ids: number[], replace?: boolean) => void;
  // Bulk operations
  bulkUpdateCollection: (collection: string | undefined) => void;
  bulkDelete: () => void;
  bulkRename: (updates: Array<{ id: number; label: string }>) => void;
  // Filter actions
  setCollectionFilter: (filter: string | null) => void;
  // Target collection action
  setTargetCollection: (collection: string | null) => void;
}

const initialState: DigitizerState = {
  imageData: null,
  imageWidth: 0,
  imageHeight: 0,
  useBoundaryMode: true,
  boundaryColor: '#989898',
  boundaryTolerance: 15,
  tolerance: 32,
  ocrEngine: 'ai',
  aiModel: 'google/gemini-2.0-flash-001',
  units: [],
  nextId: 1,
  highlightedUnitId: null,
  selectedUnitIds: new Set<number>(),
  lastSelectedId: null,
  selectedUnitOrder: [],
  collectionFilter: null,
  targetCollection: null,
};

export const useDigitizerStore = create<DigitizerState & DigitizerActions>((set, get) => ({
  ...initialState,

  setImage: (imageData: string, width: number, height: number) => {
    set({
      imageData,
      imageWidth: width,
      imageHeight: height,
      units: [],
      nextId: 1,
    });
  },

  setUseBoundaryMode: (use: boolean) => {
    set({ useBoundaryMode: use });
  },

  setBoundaryColor: (color: string) => {
    set({ boundaryColor: color });
  },

  setBoundaryTolerance: (tolerance: number) => {
    set({ boundaryTolerance: tolerance });
  },

  setTolerance: (tolerance: number) => {
    set({ tolerance });
  },

  setOcrEngine: (engine: 'tesseract' | 'ai') => {
    set({ ocrEngine: engine });
  },

  setAiModel: (model: string) => {
    set({ aiModel: model });
  },

  addLoadingUnit: (clickX: number, clickY: number) => {
    const { nextId, units, targetCollection } = get();

    const loadingUnit: Unit = {
      id: nextId,
      label: 'Loading...',
      polygon: [],
      centroid: [0, 0],
      loading: true,
      clickPosition: [clickX, clickY],
      collection: targetCollection || undefined,
    };

    set({
      units: [...units, loadingUnit],
      nextId: nextId + 1,
    });

    return nextId;
  },

  updateUnitFromResponse: (id: number, data: {
    label: string;
    polygon: number[][][];
    centroid: [number, number];
  }) => {
    set((state) => ({
      units: state.units.map((u) =>
        u.id === id
          ? { ...u, ...data, label: data.label.trim(), loading: false }
          : u
      ),
    }));
  },

  removeUnit: (id: number) => {
    set((state) => {
      const newSelected = new Set(state.selectedUnitIds);
      newSelected.delete(id);
      const newOrder = state.selectedUnitOrder.filter((unitId) => unitId !== id);
      return {
        units: state.units.filter((u) => u.id !== id),
        selectedUnitIds: newSelected,
        lastSelectedId: state.lastSelectedId === id ? null : state.lastSelectedId,
        selectedUnitOrder: newOrder,
      };
    });
  },

  updateUnit: (id: number, updates: Partial<Unit>) => {
    set((state) => ({
      units: state.units.map((u) =>
        u.id === id ? { ...u, ...updates } : u
      ),
    }));
  },

  updateLabel: (id: number, label: string) => {
    set((state) => ({
      units: state.units.map((u) =>
        u.id === id ? { ...u, label: label.trim() } : u
      ),
    }));
  },

  updateCollection: (id: number, collection: string | undefined) => {
    set((state) => ({
      units: state.units.map((u) =>
        u.id === id ? { ...u, collection: collection?.trim() || undefined } : u
      ),
    }));
  },

  getCollections: () => {
    const { units } = get();
    const collections = new Set<string>();
    for (const unit of units) {
      if (unit.collection) {
        collections.add(unit.collection);
      }
    }
    return Array.from(collections).sort();
  },

  setHighlightedUnit: (id: number | null) => {
    set({ highlightedUnitId: id });
  },

  importUnits: (importedUnits: Unit[]) => {
    const { units, nextId } = get();
    // Assign new IDs to imported units starting from nextId
    const newUnits = importedUnits.map((u, index) => ({
      ...u,
      id: nextId + index,
      label: u.label.trim(),
      loading: false,
    }));
    set({
      units: [...units, ...newUnits],
      nextId: nextId + importedUnits.length,
    });
  },

  clearAll: () => {
    set({
      units: [],
      nextId: 1,
      selectedUnitIds: new Set<number>(),
      lastSelectedId: null,
      selectedUnitOrder: [],
      collectionFilter: null,
      targetCollection: null,
    });
  },

  reset: () => {
    set(initialState);
  },

  // Selection actions
  selectUnit: (id: number) => {
    set((state) => {
      const newSelected = new Set(state.selectedUnitIds);
      const newOrder = [...state.selectedUnitOrder];
      if (newSelected.has(id)) {
        newSelected.delete(id);
        const index = newOrder.indexOf(id);
        if (index >= 0) newOrder.splice(index, 1);
      } else {
        newSelected.add(id);
        newOrder.push(id);
      }
      return {
        selectedUnitIds: newSelected,
        lastSelectedId: id,
        selectedUnitOrder: newOrder,
      };
    });
  },

  selectUnitRange: (id: number) => {
    const { lastSelectedId, units, collectionFilter, selectedUnitIds, selectedUnitOrder } = get();

    if (lastSelectedId === null) {
      // No previous selection, just select this one
      get().selectUnit(id);
      return;
    }

    // Get visible units in display order (sorted by ID descending)
    const visibleUnits = units
      .filter((u) => !u.loading && (collectionFilter === null ||
        (collectionFilter === '' ? !u.collection : u.collection === collectionFilter)))
      .sort((a, b) => b.id - a.id);

    const lastIndex = visibleUnits.findIndex((u) => u.id === lastSelectedId);
    const currentIndex = visibleUnits.findIndex((u) => u.id === id);

    if (lastIndex === -1 || currentIndex === -1) {
      get().selectUnit(id);
      return;
    }

    const startIndex = Math.min(lastIndex, currentIndex);
    const endIndex = Math.max(lastIndex, currentIndex);

    const newSelected = new Set(selectedUnitIds);
    const newOrder = [...selectedUnitOrder];
    for (let i = startIndex; i <= endIndex; i++) {
      const unitId = visibleUnits[i].id;
      newSelected.add(unitId);
      if (!newOrder.includes(unitId)) newOrder.push(unitId);
    }

    set({ selectedUnitIds: newSelected, lastSelectedId: id, selectedUnitOrder: newOrder });
  },

  selectAll: () => {
    const { units, collectionFilter } = get();
    const visibleIds = units
      .filter((u) => !u.loading && (collectionFilter === null ||
        (collectionFilter === '' ? !u.collection : u.collection === collectionFilter)))
      .map((u) => u.id);
    set({ selectedUnitIds: new Set(visibleIds), selectedUnitOrder: visibleIds });
  },

  selectNone: () => {
    set({ selectedUnitIds: new Set<number>(), lastSelectedId: null, selectedUnitOrder: [] });
  },

  selectUnitsBatch: (ids: number[], replace: boolean = false) => {
    set((state) => {
      const newSelected = replace ? new Set<number>() : new Set(state.selectedUnitIds);
      const newOrder = replace ? [] : [...state.selectedUnitOrder];
      for (const id of ids) {
        if (!newSelected.has(id)) {
          newSelected.add(id);
          newOrder.push(id);
        }
      }
      return { selectedUnitIds: newSelected, selectedUnitOrder: newOrder };
    });
  },

  // Bulk operations
  bulkUpdateCollection: (collection: string | undefined) => {
    set((state) => ({
      units: state.units.map((u) =>
        state.selectedUnitIds.has(u.id)
          ? { ...u, collection: collection?.trim() || undefined }
          : u
      ),
    }));
  },

  bulkDelete: () => {
    set((state) => ({
      units: state.units.filter((u) => !state.selectedUnitIds.has(u.id)),
      selectedUnitIds: new Set<number>(),
      lastSelectedId: null,
      selectedUnitOrder: [],
    }));
  },

  bulkRename: (updates: Array<{ id: number; label: string }>) => {
    const labelMap = new Map(updates.map((u) => [u.id, u.label.trim()]));
    set((state) => ({
      units: state.units.map((u) =>
        labelMap.has(u.id) ? { ...u, label: labelMap.get(u.id) || '' } : u
      ),
    }));
  },

  // Filter actions
  setCollectionFilter: (filter: string | null) => {
    set({ collectionFilter: filter });
  },

  // Target collection action
  setTargetCollection: (collection: string | null) => {
    set({ targetCollection: collection });
  },
}));
