import { Folder, SlidersHorizontal, Trash2, X, Pencil, MousePointer2, Wand2, TextCursorInput } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { getCollectionColor } from '../utils/collectionColors';
import Toolbar from './Toolbar';

interface CanvasActionBarProps {
  activeTool: 'select' | 'wand';
  onToolChange: (tool: 'select' | 'wand') => void;
  selectedCount: number;
  totalCount: number;
  collections: string[];
  targetCollection: string | null;
  onTargetCollectionChange: (value: string | null) => void;
  onCreateTargetCollection: () => void;
  onAssignCollection: (value: string) => void;
  onClearSelection: () => void;
  onEditSelected: () => void;
  onRenameSelected: () => void;
  onDeleteSelected: () => void;
}

function CanvasActionBar({
  activeTool,
  onToolChange,
  selectedCount,
  totalCount,
  collections,
  targetCollection,
  onTargetCollectionChange,
  onCreateTargetCollection,
  onAssignCollection,
  onClearSelection,
  onEditSelected,
  onRenameSelected,
  onDeleteSelected,
}: CanvasActionBarProps) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40">
      <TooltipProvider delayDuration={200}>
        <div className="flex items-center gap-2 px-3 py-2 rounded-2xl border border-white/10 bg-background/70 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
          <div className="flex items-center gap-1 pr-2 border-r border-white/10">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onToolChange('select')}
                  className={cn(
                    "h-7 w-7 transition-colors",
                    activeTool === 'select' ? "bg-primary/15 text-primary" : "hover:bg-primary/10 hover:text-primary"
                  )}
                >
                  <MousePointer2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Select</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onToolChange('wand')}
                  className={cn(
                    "h-7 w-7 transition-colors",
                    activeTool === 'wand' ? "bg-primary/15 text-primary" : "hover:bg-primary/10 hover:text-primary"
                  )}
                >
                  <Wand2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Magic wand</TooltipContent>
            </Tooltip>
          </div>

          {selectedCount > 0 && (
            <div className="flex items-center gap-2 pr-2 border-r border-white/10">
              <span className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Selection</span>
              <span className="text-xs font-medium">
                {selectedCount}/{totalCount}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={onClearSelection}
                    className="h-7 w-7"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Clear selection</TooltipContent>
              </Tooltip>

              <DropdownMenu>
                <Tooltip>
                  <DropdownMenuTrigger asChild>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="h-7 w-7 hover:text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Folder className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                  </DropdownMenuTrigger>
                  <TooltipContent>Assign collection</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => onAssignCollection('__clear__')}>
                    Clear collection
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onAssignCollection('__new__')}>
                    New collection...
                  </DropdownMenuItem>
                  {collections.length > 0 && <DropdownMenuSeparator />}
                  {collections.map((c) => (
                    <DropdownMenuItem key={c} onClick={() => onAssignCollection(c)}>
                      <span className="flex items-center gap-2">
                        <Folder className="h-3.5 w-3.5" style={{ color: getCollectionColor(c) }} />
                        {c}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={onEditSelected}
                    className="h-7 w-7 hover:text-amber-500 hover:bg-amber-500/10 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit polygon</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={onRenameSelected}
                    className="h-7 w-7 hover:text-primary hover:bg-primary/10 transition-colors"
                  >
                    <TextCursorInput className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Rename</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={onDeleteSelected}
                    className="h-7 w-7 hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete selected</TooltipContent>
              </Tooltip>
            </div>
          )}

          <div className="flex items-center gap-2 pr-2 border-r border-white/10">
            <span className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">New items</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs px-2">
                  <Folder className="h-3 w-3" style={{ color: getCollectionColor(targetCollection || undefined) }} />
                  {targetCollection || 'Uncategorized'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => onTargetCollectionChange(null)}>
                  Uncategorized
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onCreateTargetCollection}>
                  New collection...
                </DropdownMenuItem>
                {collections.length > 0 && <DropdownMenuSeparator />}
                {collections.map((c) => (
                  <DropdownMenuItem key={c} onClick={() => onTargetCollectionChange(c)}>
                    <span className="flex items-center gap-2">
                      <Folder className="h-3.5 w-3.5" style={{ color: getCollectionColor(c) }} />
                      {c}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-1 pr-2 border-r border-white/10">
            <Popover>
              <Tooltip>
                <PopoverTrigger asChild>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-sm" className="h-7 w-7">
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                </PopoverTrigger>
                <TooltipContent>Tools</TooltipContent>
              </Tooltip>
              <PopoverContent align="center" className="w-72 p-3">
                <Toolbar />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-center gap-1" />
        </div>
      </TooltipProvider>
    </div>
  );
}

export default CanvasActionBar;
