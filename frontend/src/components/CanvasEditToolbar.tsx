import { Button } from '@/components/ui/button';

interface CanvasEditToolbarProps {
  isEditing: boolean;
  onSave: () => void;
  onCancel: () => void;
}

function CanvasEditToolbar({ isEditing, onSave, onCancel }: CanvasEditToolbarProps) {
  if (!isEditing) return null;
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-background/70 backdrop-blur-md px-4 py-3 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.25)] flex items-center gap-4 text-sm text-warning z-50 border border-white/10">
      <span>Editing polygon - drag vertices to adjust</span>
      <div className="flex gap-2">
        <Button size="sm" onClick={onSave}>Save</Button>
        <Button size="sm" variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

export default CanvasEditToolbar;
