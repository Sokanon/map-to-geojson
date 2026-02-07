import { useCallback, useRef } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import AppHeader from './components/AppHeader';
import ImageCanvas, { CanvasApi } from './components/ImageCanvas';
import UnitList from './components/UnitList';
import { useDigitizerStore } from './stores/digitizerStore';
import { exportToTopoJSON, exportToGeoJSON, downloadFile } from './utils/topoJsonExport';
import { parseImportedUnits } from './utils/importExport';
import { loadImageSize, readFileAsDataUrl, readFileAsText } from './utils/file';

function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { units, imageData, setImage, importUnits, clearAll } = useDigitizerStore();
  const importInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<CanvasApi | null>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
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
    },
    [setImage]
  );

  const handleChangeImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImportClick = useCallback(() => {
    importInputRef.current?.click();
  }, []);

  const handleImportChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    (async () => {
      try {
        const raw = await readFileAsText(file);
        const importedUnits = await parseImportedUnits(raw);
        if (importedUnits.length > 0) {
          importUnits(importedUnits);
          toast.success('Imported items', { description: `${importedUnits.length} item${importedUnits.length !== 1 ? 's' : ''}` });
        } else {
          toast.error('No valid items found');
        }
      } catch (err) {
        toast.error('Failed to parse file');
        console.error(err);
      }
    })();
    e.target.value = '';
  }, [importUnits]);

  const handleClearAll = useCallback(() => {
    const count = units.filter(u => !u.loading).length;
    if (count > 0 && confirm(`Clear all ${count} items?`)) {
      clearAll();
      toast.success('Cleared all items');
    }
  }, [units, clearAll]);

  const handleExportTopoJSON = useCallback(() => {
    const content = exportToTopoJSON(units);
    downloadFile(content, 'units.json');
    toast.success('Exported TopoJSON', { description: `${units.length} item${units.length !== 1 ? 's' : ''}` });
  }, [units]);

  const handleExportGeoJSON = useCallback(() => {
    const content = exportToGeoJSON(units);
    downloadFile(content, 'units.geojson');
    toast.success('Exported GeoJSON', { description: `${units.length} item${units.length !== 1 ? 's' : ''}` });
  }, [units]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Toaster position="bottom-right" richColors closeButton />
      <AppHeader
        hasImage={!!imageData}
        canReset={units.filter(u => !u.loading).length > 0}
        exportDisabled={units.length === 0}
        onChangeImage={handleChangeImage}
        onImport={handleImportClick}
        onClearAll={handleClearAll}
        onExportGeo={handleExportGeoJSON}
        onExportTopo={handleExportTopoJSON}
      />
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/png,image/jpeg,image/jpg"
          onChange={handleFileChange}
        />
        <input
          ref={importInputRef}
          type="file"
          className="hidden"
          accept=".json,.geojson,.topojson"
          onChange={handleImportChange}
        />

      <main className="flex-1 flex gap-4 p-4 min-h-0 overflow-hidden">
        <aside className="w-[300px] min-w-[300px] bg-card rounded-lg p-4 flex flex-col gap-4 overflow-hidden max-h-[calc(100vh-100px)] border border-border">
          <section className="bg-background rounded-lg p-4 border border-border flex-1 min-h-0 flex flex-col overflow-hidden">
            <UnitList onFocusUnit={(id) => canvasRef.current?.focusOnUnit(id)} />
          </section>
        </aside>

        <div className="flex-1 bg-card rounded-lg overflow-hidden relative flex items-center justify-center border border-border">
          <ImageCanvas ref={canvasRef} />
        </div>
      </main>
    </div>
  );
}

export default App;
