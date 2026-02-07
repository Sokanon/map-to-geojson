import { useCallback, useRef } from 'react';
import { ChevronDown, Upload, Download, FileJson, ChevronRight, FileUp, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import ImageCanvas from './components/ImageCanvas';
import UnitList from './components/UnitList';
import { useDigitizerStore } from './stores/digitizerStore';
import { exportToTopoJSON, exportToGeoJSON, downloadFile } from './utils/topoJsonExport';

function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { units, imageData, setImage, importUnits, clearAll } = useDigitizerStore();
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const result = ev.target?.result as string;
          const img = new Image();
          img.onload = () => {
            setImage(result, img.width, img.height);
          };
          img.src = result;
        };
        reader.readAsDataURL(file);
      }
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

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const importedUnits: any[] = [];

        const extractUnit = (feature: any, collectionName?: string) => {
          if (feature.geometry?.type !== 'Polygon') return null;
          const coords = feature.geometry.coordinates;
          const ring = coords[0] || [];
          const cx = ring.reduce((sum: number, p: number[]) => sum + p[0], 0) / (ring.length || 1);
          const cy = ring.reduce((sum: number, p: number[]) => sum + p[1], 0) / (ring.length || 1);
          const collection = feature.properties?.collection ||
            (collectionName && collectionName !== 'uncategorized' ? collectionName : undefined);
          return {
            id: 0,
            label: feature.properties?.name || feature.properties?.unit || feature.properties?.building || feature.properties?.label || '',
            polygon: coords,
            centroid: [cx, cy] as [number, number],
            collection,
          };
        };

        if (json.type === 'FeatureCollection' && Array.isArray(json.features)) {
          for (const feature of json.features) {
            const unit = extractUnit(feature);
            if (unit) importedUnits.push(unit);
          }
        } else if (json.type === 'Topology') {
          const topojson = await import('topojson-client');
          for (const objectKey of Object.keys(json.objects)) {
            const geojson = topojson.feature(json, json.objects[objectKey]) as any;
            if (geojson.type === 'FeatureCollection') {
              for (const feature of geojson.features) {
                const unit = extractUnit(feature, objectKey);
                if (unit) importedUnits.push(unit);
              }
            } else if (geojson.type === 'Feature') {
              const unit = extractUnit(geojson, objectKey);
              if (unit) importedUnits.push(unit);
            }
          }
        }

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
    };
    reader.readAsText(file);
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
      <header className="bg-card px-8 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-baseline gap-4">
          <h1 className="text-2xl font-bold text-primary">Smart Map Digitizer</h1>
          <span className="text-sm text-muted-foreground">Magic wand selection with OCR labeling</span>
        </div>

        {imageData && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleChangeImage}
            >
              <Upload className="h-4 w-4 mr-2" />
              Replace Image
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleImportClick}
            >
              <FileUp className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              disabled={units.filter(u => !u.loading).length === 0}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  size="sm"
                  disabled={units.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-48 p-1">
                <button
                  onClick={handleExportTopoJSON}
                  className="flex items-center w-full px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
                >
                  <Download className="h-4 w-4 mr-2 text-muted-foreground" />
                  TopoJSON
                  <ChevronRight className="h-3 w-3 ml-auto text-muted-foreground" />
                </button>
                <button
                  onClick={handleExportGeoJSON}
                  className="flex items-center w-full px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
                >
                  <FileJson className="h-4 w-4 mr-2 text-muted-foreground" />
                  GeoJSON
                  <ChevronRight className="h-3 w-3 ml-auto text-muted-foreground" />
                </button>
              </PopoverContent>
            </Popover>
          </div>
        )}

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
      </header>

      <main className="flex-1 flex gap-4 p-4 min-h-0 overflow-hidden">
        <aside className="w-[300px] min-w-[300px] bg-card rounded-lg p-4 flex flex-col gap-4 overflow-hidden max-h-[calc(100vh-100px)] border border-border">
          <section className="bg-background rounded-lg p-4 border border-border flex-1 min-h-0 flex flex-col overflow-hidden">
            <UnitList />
          </section>
        </aside>

        <div className="flex-1 bg-card rounded-lg overflow-hidden relative flex items-center justify-center border border-border">
          <ImageCanvas />
        </div>
      </main>
    </div>
  );
}

export default App;
