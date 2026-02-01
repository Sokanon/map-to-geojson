import { useState, useCallback, useRef } from 'react';
import { ChevronDown, Upload, Download, FileJson, ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import ImageCanvas from './components/ImageCanvas';
import Toolbar from './components/Toolbar';
import UnitList from './components/UnitList';
import { useDigitizerStore } from './stores/digitizerStore';
import { exportToTopoJSON, exportToGeoJSON, downloadFile } from './utils/topoJsonExport';

function App() {
  const [configExpanded, setConfigExpanded] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { units, imageData, setImage } = useDigitizerStore();

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

  const handleExportTopoJSON = useCallback(() => {
    const content = exportToTopoJSON(units);
    downloadFile(content, 'units.json');
    toast.success('Exported TopoJSON', { description: `${units.length} unit${units.length !== 1 ? 's' : ''}` });
  }, [units]);

  const handleExportGeoJSON = useCallback(() => {
    const content = exportToGeoJSON(units);
    downloadFile(content, 'units.geojson');
    toast.success('Exported GeoJSON', { description: `${units.length} unit${units.length !== 1 ? 's' : ''}` });
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
      </header>

      <main className="flex-1 flex gap-4 p-4 min-h-0 overflow-hidden">
        <aside className="w-[300px] min-w-[300px] bg-card rounded-lg p-4 flex flex-col gap-4 overflow-hidden max-h-[calc(100vh-100px)] border border-border">
          <Collapsible open={configExpanded} onOpenChange={setConfigExpanded}>
            <section className="bg-background rounded-lg p-4 border border-border">
              <CollapsibleTrigger className="flex items-center justify-between w-full cursor-pointer">
                <h2 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Config</h2>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
                    configExpanded && "rotate-180"
                  )}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="collapsible-content">
                <div className="pt-3">
                  <Toolbar />
                </div>
              </CollapsibleContent>
            </section>
          </Collapsible>

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
