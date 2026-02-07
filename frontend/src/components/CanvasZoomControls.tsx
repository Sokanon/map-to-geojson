import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CanvasZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

function CanvasZoomControls({ zoom, onZoomIn, onZoomOut, onReset }: CanvasZoomControlsProps) {
  return (
    <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-background/70 backdrop-blur-md p-2 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.25)] border border-white/10">
      <Button
        variant="secondary"
        size="icon"
        className="h-8 w-8"
        onClick={onZoomIn}
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
        onClick={onZoomOut}
        title="Zoom out"
      >
        <ZoomOut className="h-4 w-4" />
      </Button>
      <Button
        variant="secondary"
        size="icon"
        className="h-8 w-8"
        onClick={onReset}
        title="Reset view"
      >
        <RotateCcw className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default CanvasZoomControls;
