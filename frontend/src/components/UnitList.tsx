import { useCallback, useState, useMemo } from 'react';
import { Pencil, MapPin, MoreVertical, Trash2, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useDigitizerStore } from '../stores/digitizerStore';
import { getCollectionColor } from '../utils/collectionColors';

function UnitList() {
  const {
    units,
    highlightedUnitId,
    setHighlightedUnit,
    removeUnit,
    updateLabel,
    updateCollection,
    getCollections,
    // Selection
    selectedUnitIds,
    // Filter
    collectionFilter,
    setCollectionFilter,
  } = useDigitizerStore();

  const [editingCollectionId, setEditingCollectionId] = useState<number | null>(null);
  const [itemMenuOpen, setItemMenuOpen] = useState<number | null>(null);

  // Filter units based on collection filter
  const filteredUnits = useMemo(() => {
    if (collectionFilter === null) return units;
    if (collectionFilter === '') return units.filter((u) => !u.collection);
    return units.filter((u) => u.collection === collectionFilter);
  }, [units, collectionFilter]);

  // Sort filtered units by ID descending
  const sortedUnits = useMemo(
    () => [...filteredUnits].sort((a, b) => b.id - a.id),
    [filteredUnits]
  );

  // Count visible (non-loading) units
  const visibleCount = useMemo(
    () => filteredUnits.filter((u) => !u.loading).length,
    [filteredUnits]
  );

  const duplicateLabelSet = useMemo(() => {
    const counts = new Map<string, number>();
    for (const unit of units) {
      if (unit.loading) continue;
      const key = unit.label.trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const dupes = new Set<string>();
    for (const [key, count] of counts) {
      if (count > 1) dupes.add(key);
    }
    return dupes;
  }, [units]);

  const collections = getCollections();

  // Get counts per collection
  const collectionCounts = useMemo(() => {
    const counts: Record<string, number> = { __uncategorized__: 0 };
    for (const unit of units) {
      if (!unit.loading) {
        if (unit.collection) {
          counts[unit.collection] = (counts[unit.collection] || 0) + 1;
        } else {
          counts.__uncategorized__++;
        }
      }
    }
    return counts;
  }, [units]);

  const handleMouseEnter = useCallback(
    (id: number) => {
      setHighlightedUnit(id);
    },
    [setHighlightedUnit]
  );

  const handleMouseLeave = useCallback(() => {
    setHighlightedUnit(null);
  }, [setHighlightedUnit]);

  const handleDelete = useCallback(
    (id: number) => {
      removeUnit(id);
      setItemMenuOpen(null);
    },
    [removeUnit]
  );

  const handleEditPolygon = useCallback((id: number) => {
    const fns = (window as any).__canvasEditFns;
    if (fns?.startEditing) {
      fns.startEditing(id);
    }
    setItemMenuOpen(null);
  }, []);

  const handleFocusUnit = useCallback((id: number) => {
    const fns = (window as any).__canvasEditFns;
    if (fns?.focusOnUnit) {
      fns.focusOnUnit(id);
    }
  }, []);

  const handleLabelChange = useCallback(
    (id: number, label: string) => {
      updateLabel(id, label);
    },
    [updateLabel]
  );

  const handleCollectionChange = useCallback(
    (id: number, collection: string) => {
      updateCollection(id, collection || undefined);
    },
    [updateCollection]
  );

  const handleCollectionBlur = useCallback(() => {
    setEditingCollectionId(null);
  }, []);

  const handleFilterChange = useCallback(
    (value: string) => {
      if (value === '__all__') {
        setCollectionFilter(null);
      } else if (value === '__uncategorized__') {
        setCollectionFilter('');
      } else {
        setCollectionFilter(value);
      }
    },
    [setCollectionFilter]
  );

  const handleCreateCollectionFromFilter = useCallback(() => {
    const name = prompt('Enter new collection name:');
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    setCollectionFilter(trimmed);
  }, [setCollectionFilter]);

  const editingUnitId = (window as any).__canvasEditFns?.editingUnitId;

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      {/* Header */}
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground tracking-wide py-1.5 mb-2 flex-shrink-0">
        {/* Title with count */}
        <div className="flex-1">
          <span>
            Items
            {visibleCount > 0 ? ` (${visibleCount})` : ''}
          </span>
        </div>

        {/* Filter dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-6 w-auto gap-1 text-[0.65rem] px-2 font-normal normal-case">
              <Folder className="h-3 w-3 flex-shrink-0" />
              {collectionFilter === null ? 'All' : collectionFilter === '' ? 'Uncategorized' : collectionFilter}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => handleFilterChange('__all__')}>
              All
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex items-center justify-between"
              onClick={() => handleFilterChange('__uncategorized__')}
            >
              <span className="flex items-center gap-2">
                <Folder className="h-3.5 w-3.5" style={{ color: getCollectionColor(undefined) }} />
                <span>Uncategorized</span>
                <span className="text-muted-foreground text-xs">{collectionCounts.__uncategorized__}</span>
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCreateCollectionFromFilter}>
              New collection...
            </DropdownMenuItem>
            {collections.length > 0 && <DropdownMenuSeparator />}
            {collections.map((c) => {
              const color = getCollectionColor(c);
              return (
                <DropdownMenuItem
                  key={c}
                  className="flex items-center justify-between"
                  onClick={() => handleFilterChange(c)}
                >
                  <span className="flex items-center gap-2">
                    <Folder className="h-3.5 w-3.5" style={{ color }} />
                    <span>{c}</span>
                    <span className="text-muted-foreground text-xs">{collectionCounts[c] || 0}</span>
                  </span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Bulk actions moved to floating map bar */}
      </div>

      {/* Item list */}
      {sortedUnits.length > 0 && (
        <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 min-h-0 custom-scrollbar">
          {sortedUnits.map((unit) => {
            const isSelected = selectedUnitIds.has(unit.id);
            const collectionColor = getCollectionColor(unit.collection);
            const labelKey = unit.label.trim();
            const isDuplicateLabel = labelKey.length > 0 && duplicateLabelSet.has(labelKey);

            return (
              <div
                key={unit.id}
                className={cn(
                  'p-1.5 bg-background rounded-lg border border-transparent',
                  unit.loading && 'bg-primary/10 border-primary/30',
                  highlightedUnitId === unit.id && 'bg-primary/20 border-primary',
                  editingUnitId === unit.id && 'bg-warning/20 border-warning',
                  isSelected && !unit.loading && 'bg-primary/10 border-primary/50',
                  isDuplicateLabel && !unit.loading && 'bg-destructive/10 border-destructive/60'
                )}
                onMouseEnter={() => !unit.loading && handleMouseEnter(unit.id)}
                onMouseLeave={handleMouseLeave}
              >
                {/* Single row: Name + ID | Collection + actions */}
                <div className="flex items-center gap-1.5">
                  {unit.loading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-border border-t-primary rounded-full animate-spin flex-shrink-0" />
                      <span className="text-muted-foreground text-sm flex-1">Loading...</span>
                      <Button
                        variant="ghost-subtle"
                        size="icon-sm"
                        onClick={() => handleDelete(unit.id)}
                        title="Cancel"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      {/* Name + ID */}
                      <Input
                        type="text"
                        className={cn(
                          "flex-1 min-w-0 h-auto py-1 px-0 text-sm bg-transparent border-transparent hover:border-border hover:bg-background hover:px-2 focus:border-primary focus:bg-background focus:px-2",
                          isDuplicateLabel && "text-destructive"
                        )}
                        value={unit.label}
                        onChange={(e) => handleLabelChange(unit.id, e.target.value)}
                        placeholder="Enter name..."
                      />
                      <span className="text-[0.65rem] text-muted-foreground font-medium flex-shrink-0">
                        #{unit.id}
                      </span>

                      {/* Collection badge */}
                      {editingCollectionId === unit.id ? (
                        <Input
                          type="text"
                          className="w-24 h-auto py-0.5 px-2 text-xs bg-transparent border-border focus:border-primary"
                          value={unit.collection || ''}
                          onChange={(e) => handleCollectionChange(unit.id, e.target.value)}
                          onBlur={handleCollectionBlur}
                          onKeyDown={(e) => e.key === 'Enter' && handleCollectionBlur()}
                          placeholder="Collection..."
                          autoFocus
                          list={`collections-${unit.id}`}
                        />
                      ) : (
                        <button
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[0.6rem] font-medium transition-colors hover:opacity-80 flex-shrink-0"
                          style={{
                            backgroundColor: `${collectionColor}20`,
                            color: collectionColor,
                          }}
                          onClick={() => setEditingCollectionId(unit.id)}
                          title="Click to change collection"
                        >
                          <Folder className="h-2.5 w-2.5" />
                          {unit.collection || 'Uncategorized'}
                        </button>
                      )}
                      <datalist id={`collections-${unit.id}`}>
                        {collections.map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>

                      {/* Actions */}
                      <Button
                        variant="ghost-primary"
                        size="icon-sm"
                        onClick={() => handleFocusUnit(unit.id)}
                        title="Go to item"
                      >
                        <MapPin className="h-3.5 w-3.5" />
                      </Button>
                      <Popover
                        open={itemMenuOpen === unit.id}
                        onOpenChange={(open: boolean) => setItemMenuOpen(open ? unit.id : null)}
                      >
                        <PopoverTrigger asChild>
                          <Button variant="ghost-subtle" size="icon-sm" title="More actions">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-36 p-1" align="end">
                          <button
                            className="flex items-center w-full px-2 py-1.5 text-sm rounded hover:bg-accent transition-colors"
                            onClick={() => handleEditPolygon(unit.id)}
                            disabled={editingUnitId !== null}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                            Edit shape
                          </button>
                          <button
                            className="flex items-center w-full px-2 py-1.5 text-sm rounded hover:bg-destructive/10 text-destructive transition-colors"
                            onClick={() => handleDelete(unit.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                            Delete
                          </button>
                        </PopoverContent>
                      </Popover>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sortedUnits.length === 0 && units.length > 0 && (
        <div className="text-center text-muted-foreground text-sm py-4">
          <p>No items match filter.</p>
          <button
            className="text-xs text-primary hover:underline mt-1"
            onClick={() => setCollectionFilter(null)}
          >
            Clear filter
          </button>
        </div>
      )}

      {units.length === 0 && (
        <div className="text-center text-muted-foreground text-sm py-4">
          <p>No items added yet.</p>
          <p className="text-xs italic mt-2">Click on the map to select regions.</p>
        </div>
      )}
    </div>
  );
}

export default UnitList;
