import { create } from 'zustand';
import { Building } from '../types';

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
  buildings: Building[];
  nextId: number;
  highlightedBuildingId: number | null;
}

interface DigitizerActions {
  setImage: (imageData: string, width: number, height: number) => void;
  setUseBoundaryMode: (use: boolean) => void;
  setBoundaryColor: (color: string) => void;
  setBoundaryTolerance: (tolerance: number) => void;
  setTolerance: (tolerance: number) => void;
  setOcrEngine: (engine: 'tesseract' | 'ai') => void;
  setAiModel: (model: string) => void;
  addLoadingBuilding: (clickX: number, clickY: number) => number; // Returns the ID of the new loading building
  updateBuildingFromResponse: (id: number, data: {
    label: string;
    polygon: number[][][];
    centroid: [number, number];
  }) => void;
  removeBuilding: (id: number) => void;
  updateBuilding: (id: number, updates: Partial<Building>) => void;
  updateLabel: (id: number, label: string) => void;
  setHighlightedBuilding: (id: number | null) => void;
  importBuildings: (buildings: Building[]) => void;
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
  buildings: [],
  nextId: 1,
  highlightedBuildingId: null,
};

export const useDigitizerStore = create<DigitizerState & DigitizerActions>((set, get) => ({
  ...initialState,

  setImage: (imageData: string, width: number, height: number) => {
    set({
      imageData,
      imageWidth: width,
      imageHeight: height,
      buildings: [],
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

  addLoadingBuilding: (clickX: number, clickY: number) => {
    const { nextId, buildings } = get();

    const loadingBuilding: Building = {
      id: nextId,
      label: 'Loading...',
      polygon: [],
      centroid: [0, 0],
      loading: true,
      clickPosition: [clickX, clickY],
    };

    set({
      buildings: [...buildings, loadingBuilding],
      nextId: nextId + 1,
    });

    return nextId;
  },

  updateBuildingFromResponse: (id: number, data: {
    label: string;
    polygon: number[][][];
    centroid: [number, number];
  }) => {
    set((state) => ({
      buildings: state.buildings.map((b) =>
        b.id === id
          ? { ...b, ...data, label: data.label.trim(), loading: false }
          : b
      ),
    }));
  },

  removeBuilding: (id: number) => {
    set((state) => ({
      buildings: state.buildings.filter((b) => b.id !== id),
    }));
  },

  updateBuilding: (id: number, updates: Partial<Building>) => {
    set((state) => ({
      buildings: state.buildings.map((b) =>
        b.id === id ? { ...b, ...updates } : b
      ),
    }));
  },

  updateLabel: (id: number, label: string) => {
    set((state) => ({
      buildings: state.buildings.map((b) =>
        b.id === id ? { ...b, label: label.trim() } : b
      ),
    }));
  },

  setHighlightedBuilding: (id: number | null) => {
    set({ highlightedBuildingId: id });
  },

  importBuildings: (importedBuildings: Building[]) => {
    const { buildings, nextId } = get();
    // Assign new IDs to imported buildings starting from nextId
    const newBuildings = importedBuildings.map((b, index) => ({
      ...b,
      id: nextId + index,
      label: b.label.trim(),
      loading: false,
    }));
    set({
      buildings: [...buildings, ...newBuildings],
      nextId: nextId + importedBuildings.length,
    });
  },

  clearAll: () => {
    set({
      buildings: [],
      nextId: 1,
    });
  },

  reset: () => {
    set(initialState);
  },
}));
