import { useMemo } from 'react';
import { Unit } from '../types';

export function useDuplicateLabels(units: Unit[]): Set<string> {
  return useMemo(() => {
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
}
