import { ChevronDown, Upload, Download, FileJson, ChevronRight, FileUp, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface AppHeaderProps {
  hasImage: boolean;
  canReset: boolean;
  exportDisabled: boolean;
  onChangeImage: () => void;
  onImport: () => void;
  onClearAll: () => void;
  onExportTopo: () => void;
  onExportGeo: () => void;
}

function AppHeader({
  hasImage,
  canReset,
  exportDisabled,
  onChangeImage,
  onImport,
  onClearAll,
  onExportTopo,
  onExportGeo,
}: AppHeaderProps) {
  return (
    <header className="bg-card px-8 py-3 border-b border-border flex items-center justify-between">
      <div className="flex items-baseline gap-4">
        <h1 className="text-2xl font-bold text-primary">Smart Map Digitizer</h1>
        <span className="text-sm text-muted-foreground">Magic wand selection with OCR labeling</span>
      </div>

      {hasImage && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onChangeImage}
          >
            <Upload className="h-4 w-4 mr-2" />
            Replace Image
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onImport}
          >
            <FileUp className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onClearAll}
            disabled={!canReset}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                disabled={exportDisabled}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-48 p-1">
              <button
                onClick={onExportTopo}
                className="flex items-center w-full px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
              >
                <Download className="h-4 w-4 mr-2 text-muted-foreground" />
                TopoJSON
                <ChevronRight className="h-3 w-3 ml-auto text-muted-foreground" />
              </button>
              <button
                onClick={onExportGeo}
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
    </header>
  );
}

export default AppHeader;
