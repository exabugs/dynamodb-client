import type { ShadowDiff } from './types.js';

/**
 * 旧シャドーキーと新シャドーキーの差分を計算する
 *
 * この関数は、レコード更新時に既存のシャドーレコードと新しく生成すべき
 * シャドーレコードを比較し、削除すべきものと追加すべきものを特定します。
 *
 * @param oldShadowKeys - 既存のシャドーSKの配列
 * @param newShadowKeys - 新しく生成されたシャドーSKの配列
 * @returns 削除すべきSKと追加すべきSKのリスト
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
  // Set を使用して効率的な差分計算を行う
  const oldSet = new Set(oldShadowKeys);
  const newSet = new Set(newShadowKeys);

  // 削除すべきキー: 旧キーに存在するが新キーに存在しない
  const toDelete = oldShadowKeys.filter((key) => !newSet.has(key));

  // 追加すべきキー: 新キーに存在するが旧キーに存在しない
  const toAdd = newShadowKeys.filter((key) => !oldSet.has(key));

  return {
    toDelete,
    toAdd,
  };
}

/**
 * シャドー差分が空かどうかを判定する
 *
 * @param diff - シャドー差分オブジェクト
 * @returns 差分が空の場合true
 */
export function isDiffEmpty(diff: ShadowDiff): boolean {
  return diff.toDelete.length === 0 && diff.toAdd.length === 0;
}

/**
 * 複数のシャドー差分をマージする
 *
 * @param diffs - マージするシャドー差分の配列
 * @returns マージされたシャドー差分
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
