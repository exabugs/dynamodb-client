import type { ShadowDiff } from './types.js';

/**
 * Calculate difference between old and new shadow keys
 *
 * This function compares existing shadow records with newly generated ones
 * during record updates, identifying which ones should be deleted and added.
 *
 * @param oldShadowKeys - Array of existing shadow SKs
 * @param newShadowKeys - Array of newly generated shadow SKs
 * @returns List of SKs to delete and add
 *
 * @example
 * const oldKeys = [
 *   'name#Old#Name#id#01HZXY123',
 *   'priority#00000000000000000010#id#01HZXY123'
 * ];
 * const newKeys = [
 *   'name#New#Name#id#01HZXY123',
 *   'priority#00000000000000000010#id#01HZXY123'
 * ];
 * const diff = calculateShadowDiff(oldKeys, newKeys);
 * // => {
 * //   toDelete: ['name#Old#Name#id#01HZXY123'],
 * //   toAdd: ['name#New#Name#id#01HZXY123']
 * // }
 */
export function calculateShadowDiff(oldShadowKeys: string[], newShadowKeys: string[]): ShadowDiff {
  // Use Set for efficient difference calculation
  const oldSet = new Set(oldShadowKeys);
  const newSet = new Set(newShadowKeys);

  // Keys to delete: exist in old but not in new
  const toDelete = oldShadowKeys.filter((key) => !newSet.has(key));

  // Keys to add: exist in new but not in old
  const toAdd = newShadowKeys.filter((key) => !oldSet.has(key));

  return {
    toDelete,
    toAdd,
  };
}

/**
 * Check if shadow difference is empty
 *
 * @param diff - Shadow difference object
 * @returns True if difference is empty
 */
export function isDiffEmpty(diff: ShadowDiff): boolean {
  return diff.toDelete.length === 0 && diff.toAdd.length === 0;
}

/**
 * Merge multiple shadow differences
 *
 * @param diffs - Array of shadow differences to merge
 * @returns Merged shadow difference
 */
export function mergeShadowDiffs(diffs: ShadowDiff[]): ShadowDiff {
  const allToDelete = new Set<string>();
  const allToAdd = new Set<string>();

  for (const diff of diffs) {
    diff.toDelete.forEach((key) => allToDelete.add(key));
    diff.toAdd.forEach((key) => allToAdd.add(key));
  }

  return {
    toDelete: Array.from(allToDelete),
    toAdd: Array.from(allToAdd),
  };
}
