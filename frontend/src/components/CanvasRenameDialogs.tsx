import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface RenamePreviewItem {
  id: number;
  from: string;
  to: string;
}

interface CanvasRenameDialogsProps {
  renameSingleOpen: boolean;
  onRenameSingleOpenChange: (open: boolean) => void;
  renameSingleValue: string;
  onRenameSingleValueChange: (value: string) => void;
  onRenameSingleApply: () => void;
  renameSequenceOpen: boolean;
  onRenameSequenceOpenChange: (open: boolean) => void;
  renamePrefix: string;
  onRenamePrefixChange: (value: string) => void;
  renameStartNumber: string;
  onRenameStartNumberChange: (value: string) => void;
  renameDirection: 'asc' | 'desc';
  onRenameDirectionChange: (value: 'asc' | 'desc') => void;
  renameError: string | null;
  renamePreview: RenamePreviewItem[];
  onRenameSequenceApply: () => void;
}

function CanvasRenameDialogs({
  renameSingleOpen,
  onRenameSingleOpenChange,
  renameSingleValue,
  onRenameSingleValueChange,
  onRenameSingleApply,
  renameSequenceOpen,
  onRenameSequenceOpenChange,
  renamePrefix,
  onRenamePrefixChange,
  renameStartNumber,
  onRenameStartNumberChange,
  renameDirection,
  onRenameDirectionChange,
  renameError,
  renamePreview,
  onRenameSequenceApply,
}: CanvasRenameDialogsProps) {
  return (
    <>
      <Dialog open={renameSingleOpen} onOpenChange={onRenameSingleOpenChange}>
        <DialogContent
          className="sm:max-w-[420px] pointer-events-auto z-[60]"
          onPointerDownCapture={(e) => e.stopPropagation()}
          data-rename-dialog
        >
          <DialogHeader>
            <DialogTitle>Rename polygon</DialogTitle>
            <DialogDescription>
              Update the label for the selected polygon.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <label className="text-xs text-muted-foreground">Name</label>
            <input
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={renameSingleValue}
              onChange={(e) => onRenameSingleValueChange(e.target.value)}
              placeholder="Enter name"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onRenameSingleOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={onRenameSingleApply} disabled={!renameSingleValue.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameSequenceOpen} onOpenChange={onRenameSequenceOpenChange}>
        <DialogContent
          className="sm:max-w-[520px] pointer-events-auto z-[60]"
          onPointerDownCapture={(e) => e.stopPropagation()}
          data-rename-dialog
        >
          <DialogHeader>
            <DialogTitle>Smart rename</DialogTitle>
            <DialogDescription>
              Apply a sequence name in the order you selected polygons.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Prefix</label>
                <input
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={renamePrefix}
                  onChange={(e) => onRenamePrefixChange(e.target.value)}
                  placeholder="e.g. 19-"
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Starting number</label>
                <input
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={renameStartNumber}
                  onChange={(e) => onRenameStartNumberChange(e.target.value)}
                  placeholder="e.g. 002"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Direction</label>
                <select
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  value={renameDirection}
                  onChange={(e) => onRenameDirectionChange(e.target.value as 'asc' | 'desc')}
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </div>
              {renameError && (
                <span className="text-[0.7rem] text-destructive col-span-3">{renameError}</span>
              )}
            </div>
            <div className="rounded-md border border-white/10 bg-background/50">
              <div className="px-3 py-2 text-[0.7rem] uppercase text-muted-foreground border-b border-white/10">
                Preview ({renamePreview.length})
              </div>
              <div className="max-h-48 overflow-y-auto custom-scrollbar">
                {renamePreview.length === 0 ? (
                  <div className="px-3 py-3 text-sm text-muted-foreground">No preview yet.</div>
                ) : (
                  renamePreview.map((r) => (
                    <div key={r.id} className="flex items-center justify-between px-3 py-2 text-sm border-b border-white/5 last:border-b-0">
                      <span className="truncate text-muted-foreground">{r.from || `#${r.id}`}</span>
                      <span className="ml-4 font-medium">{r.to}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onRenameSequenceOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={onRenameSequenceApply} disabled={!!renameError || renamePreview.length === 0}>
              Apply rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CanvasRenameDialogs;
