import { Unit } from '../types';

export const UNCATEGORIZED_KEY = '__uncategorized__';

export function getCollectionsFromUnits(units: Unit[]): string[] {
  const collections = new Set<string>();
  for (const unit of units) {
    if (unit.collection) {
      collections.add(unit.collection);
    }
  }
  return Array.from(collections).sort();
}

export function getCollectionCounts(units: Unit[]): Record<string, number> {
  const counts: Record<string, number> = { [UNCATEGORIZED_KEY]: 0 };
  for (const unit of units) {
    if (unit.loading) continue;
    if (unit.collection) {
      counts[unit.collection] = (counts[unit.collection] || 0) + 1;
    } else {
      counts[UNCATEGORIZED_KEY] = (counts[UNCATEGORIZED_KEY] || 0) + 1;
    }
  }
  return counts;
}
