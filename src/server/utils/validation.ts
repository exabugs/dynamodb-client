/**
 * 入力検証ユーティリティ
 */
import { InvalidFilterError } from '../../index.js';
import { getDefaultSort, isValidShadowField } from '../shadow/index.js';
import type { ShadowConfig } from '../shadow/index.js';
import type { FindManyReferenceParams, FindParams } from '../types.js';

/**
 * getList/getManyReferenceのソートフィールドを検証する
 *
 * @param config - シャドー設定
 * @param resource - リソース名
 * @param sort - ソート条件
 * @throws {InvalidFilterError} ソートフィールドが無効な場合
 */
export function validateSortField(
  config: ShadowConfig,
  resource: string,
  sort?: { field: string; order: 'ASC' | 'DESC' }
): void {
  if (!sort) {
    return;
  }

  const { field } = sort;

  // idフィールドは常に有効（本体レコードとして存在）
  if (field === 'id') {
    return;
  }

  // シャドーフィールドとして有効かチェック
  if (!isValidShadowField(config, resource, field)) {
    throw new InvalidFilterError(`Invalid sort field: ${field}`, { field, resource });
  }
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
 * @param config - シャドー設定
 * @param resource - リソース名
 * @param sort - ソート条件
 * @returns 正規化されたソート条件
 */
export function normalizeSort(
  config: ShadowConfig,
  resource: string,
  sort?: { field: string; order: 'ASC' | 'DESC' }
): { field: string; order: 'ASC' | 'DESC' } {
  if (sort) {
    return sort;
  }

  // デフォルトソートを取得
  return getDefaultSort(config, resource);
}
