/**
 * Find操作のユーティリティ関数
 */

import type { FindParams } from '../../types.js';
import type { FindContext, ParsedFilter, OptimizableFilter, NormalizedFindParams } from './types.js';
import { getShadowConfig } from '../../shadow/index.js';
import { createLogger } from '../../../shared/index.js';
import { parseFilterField } from '../../utils/filter.js';
import { ConfigError } from '../../../shared/errors/index.js';
import { normalizeSort as originalNormalizeSort, normalizePagination as originalNormalizePagination } from '../../utils/validation.js';

const logger = createLogger({
  service: 'find-utils',
  level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
});

/**
 * Find操作の設定を初期化する
 * 
 * @returns シャドウ設定
 */
export function initializeFindConfig() {
  return getShadowConfig();
}

/**
 * Find操作のパラメータを正規化する
 * 
 * @param config - シャドウ設定
 * @param resource - リソース名
 * @param params - Find操作のパラメータ
 * @returns 正規化されたパラメータ
 */
export function normalizeFindParams(
  config: any,
  resource: string,
  params: FindParams
): NormalizedFindParams {
  // ソート条件を正規化
  const sort = originalNormalizeSort(config, resource, params.sort);
  
  // ページネーション条件を正規化
  const pagination = originalNormalizePagination(params.pagination);

  // フィルター条件を解析
  const parsedFilters = parseFilters(params.filter);

  return {
    sort,
    pagination,
    parsedFilters,
  };
}

/**
 * フィルター条件を解析する
 * 
 * @param filter - フィルター条件
 * @returns 解析済みフィルター条件の配列
 */
function parseFilters(
  filter?: Record<string, unknown>
): ParsedFilter[] {
  const parsedFilters: ParsedFilter[] = [];

  if (!filter || Object.keys(filter).length === 0) {
    return parsedFilters;
  }

  for (const [fieldKey, value] of Object.entries(filter)) {
    try {
      const parsed = parseFilterField(fieldKey);
      parsedFilters.push({ parsed, value });
    } catch (error) {
      logger.error('Invalid filter field syntax', {
        fieldKey,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new ConfigError(`Invalid filter field syntax: ${fieldKey}`, {
        field: fieldKey,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return parsedFilters;
}

/**
 * 最適化可能なフィルター条件を検索する
 * 
 * @param sortField - ソートフィールド
 * @param parsedFilters - 解析済みフィルター条件
 * @returns 最適化可能なフィルター条件（見つからない場合はundefined）
 */
export function findOptimizableFilter(
  sortField: string,
  parsedFilters: ParsedFilter[]
): OptimizableFilter | undefined {
  return parsedFilters.find(
    (filter) => filter.parsed.field === sortField
  ) as OptimizableFilter | undefined;
}

/**
 * すべてのフィルター条件にマッチするかチェックする
 * 
 * @param record - レコード
 * @param parsedFilters - 解析済みフィルター条件
 * @returns マッチする場合true
 */
export function matchesAllFilters(
  record: Record<string, unknown>,
  parsedFilters: ParsedFilter[]
): boolean {
  return parsedFilters.every((filter) => {
    const { field, operator } = filter.parsed;
    const recordValue = record[field];
    const filterValue = filter.value;

    switch (operator) {
      case 'eq':
        return recordValue === filterValue;
      case 'ne':
        return recordValue !== filterValue;
      case 'gt':
        return recordValue != null && recordValue > filterValue;
      case 'gte':
        return recordValue != null && recordValue >= filterValue;
      case 'lt':
        return recordValue != null && recordValue < filterValue;
      case 'lte':
        return recordValue != null && recordValue <= filterValue;
      case 'in':
        return Array.isArray(filterValue) && filterValue.includes(recordValue);
      case 'nin':
        return Array.isArray(filterValue) && !filterValue.includes(recordValue);
      case 'starts':
        return typeof recordValue === 'string' && typeof filterValue === 'string' && recordValue.startsWith(filterValue);
      default:
        return true;
    }
  });
}