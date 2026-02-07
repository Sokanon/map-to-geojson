import type { ChangeEvent, DragEvent, RefObject } from 'react';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CanvasEmptyStateProps {
  isDragging: boolean;
  onClick: () => void;
  onDrop: (e: DragEvent) => void;
  onDragOver: (e: DragEvent) => void;
  onDragLeave: (e: DragEvent) => void;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: RefObject<HTMLInputElement>;
}

function CanvasEmptyState({
  isDragging,
  onClick,
  onDrop,
  onDragOver,
  onDragLeave,
  onFileChange,
  fileInputRef,
}: CanvasEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center h-full w-full text-muted-foreground gap-6 cursor-pointer transition-all",
        isDragging && "bg-primary/10"
      )}
      onClick={onClick}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      <div
        className={cn(
          "flex flex-col items-center gap-4 p-12 rounded-xl border-2 border-dashed transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-border"
        )}
      >
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
        onChange={onFileChange}
      />
    </div>
  );
}

export default CanvasEmptyState;
