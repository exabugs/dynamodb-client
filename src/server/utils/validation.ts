/**
 * 入力検証ユーティリティ
 */
import type { ShadowConfig } from '../shadow/config.js';
import type { FindManyReferenceParams, FindParams } from '../types.js';

/**
 * getList/getManyReferenceのソートフィールドを検証する
 *
 * 新しい実装: すべてのフィールドが自動的にシャドウ化されるため、検証は不要
 *
 * @param _config - シャドー設定（未使用）
 * @param _resource - リソース名（未使用）
 * @param _sort - ソート条件（未使用）
 */
export function validateSortField(
  _config: ShadowConfig,
  _resource: string,
  _sort?: { field: string; order: 'ASC' | 'DESC' }
): void {
  // 新しい実装では、すべてのフィールドが自動的にシャドウ化されるため、
  // ソートフィールドの検証は不要
  // レコードにフィールドが存在しない場合は、クエリ結果に含まれないだけ
  return;
}

/**
 * ページネーションパラメータを正規化する
 *
 * @param pagination - ページネーション条件
 * @returns 正規化されたページネーション条件
 */
export function normalizePagination(
  pagination?: FindParams['pagination'] | FindManyReferenceParams['pagination']
): { perPage: number; nextToken?: string } {
  const perPage = Math.min(pagination?.perPage || 50, 50); // 最大50件
  const nextToken = pagination?.nextToken;

  return { perPage, nextToken };
}

/**
 * ソート条件を正規化する（デフォルト値を適用）
 *
 * 新しい実装: デフォルトソートはupdatedAtフィールド（降順）
 *
 * @param config - シャドー設定
 * @param _resource - リソース名（未使用）
 * @param sort - ソート条件
 * @returns 正規化されたソート条件
 */
export function normalizeSort(
  config: ShadowConfig,
  _resource: string,
  sort?: { field: string; order: 'ASC' | 'DESC' }
): { field: string; order: 'ASC' | 'DESC' } {
  if (sort) {
    return sort;
  }

  // デフォルトソート: updatedAtフィールド（降順）
  return {
    field: config.updatedAtField,
    order: 'DESC',
  };
}
