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
  setHighlightedUnit: (id: number | null) => void;
  importUnits: (units: Unit[]) => void;
  clearAll: () => void;
  reset: () => void;
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
    const { nextId, units } = get();

    const loadingUnit: Unit = {
      id: nextId,
      label: 'Loading...',
      polygon: [],
      centroid: [0, 0],
      loading: true,
      clickPosition: [clickX, clickY],
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
    set((state) => ({
      units: state.units.filter((u) => u.id !== id),
    }));
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
    });
  },

  reset: () => {
    set(initialState);
  },
}));
