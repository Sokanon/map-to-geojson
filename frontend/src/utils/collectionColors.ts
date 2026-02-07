// Color palette for collections - distinct, accessible colors
const COLLECTION_COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
  '#6366f1', // indigo
];

const UNCATEGORIZED_COLOR = '#6b7280'; // gray

/**
 * Get a deterministic color for a collection name.
 * Uses a simple hash to map collection names to palette colors.
 * Returns gray for uncategorized (undefined/empty) collections.
 */
export function getCollectionColor(collection: string | undefined): string {
  if (!collection) return UNCATEGORIZED_COLOR;

  // Simple hash function: djb2 variant
  let hash = 5381;
  for (let i = 0; i < collection.length; i++) {
    hash = ((hash << 5) + hash) ^ collection.charCodeAt(i);
  }

  return COLLECTION_COLORS[Math.abs(hash) % COLLECTION_COLORS.length];
}

/**
 * Get color with alpha for polygon fills
 */
export function getCollectionFillColor(collection: string | undefined, alpha: number = 0.25): string {
  const color = getCollectionColor(collection);
  // Convert hex to rgba
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
