/**
 * Find操作のユーティリティ関数
 */
import { ConfigError } from '../../../shared/errors/index.js';
import type { NearQuery } from '../../../shared/geohash/types.js';
import { createLogger } from '../../../shared/index.js';
import { getShadowConfig } from '../../shadow/index.js';
import type { FindParams } from '../../types.js';
import { parseFilterField } from '../../utils/filter.js';
import {
  normalizePagination as originalNormalizePagination,
  normalizeSort as originalNormalizeSort,
} from '../../utils/validation.js';
import type { NormalizedFindParams, OptimizableFilter, ParsedFilter } from './types.js';

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
 * 2つの形式をサポート:
 * 1. フィールド名に演算子を含める形式: { "id:$in": ["value1", "value2"] }
 * 2. ネストされたオブジェクト形式: { id: { $in: ["value1", "value2"] } }
 *
 * @param filter - フィルター条件
 * @returns 解析済みフィルター条件の配列
 */
function parseFilters(filter?: Record<string, unknown>): ParsedFilter[] {
  const parsedFilters: ParsedFilter[] = [];

  if (!filter || Object.keys(filter).length === 0) {
    return parsedFilters;
  }

  for (const [fieldKey, value] of Object.entries(filter)) {
    try {
      // 値がオブジェクトの場合、ネストされた演算子形式として処理
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // { id: { $in: ["value1", "value2"] } } 形式
        for (const [operator, operatorValue] of Object.entries(value)) {
          const parsed = parseFilterField(`${fieldKey}:${operator}`);
          parsedFilters.push({ parsed, value: operatorValue });
        }
      } else {
        // { "id:$in": ["value1", "value2"] } 形式または { id: "value" } 形式
        const parsed = parseFilterField(fieldKey);
        parsedFilters.push({ parsed, value });
      }
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
  return parsedFilters.find((filter) => filter.parsed.field === sortField) as
    | OptimizableFilter
    | undefined;
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
    const filterValue = filter.value as any;

    switch (operator) {
      case '$eq':
        return recordValue === filterValue;
      case '$ne':
        return recordValue !== filterValue;
      case '$gt':
        return recordValue != null && recordValue > (filterValue as any);
      case '$gte':
        return recordValue != null && recordValue >= (filterValue as any);
      case '$lt':
        return recordValue != null && recordValue < (filterValue as any);
      case '$lte':
        return recordValue != null && recordValue <= (filterValue as any);
      case '$in':
        return Array.isArray(filterValue) && filterValue.includes(recordValue);
      case '$nin':
        return Array.isArray(filterValue) && !filterValue.includes(recordValue);
      case '$starts':
        return (
          typeof recordValue === 'string' &&
          typeof filterValue === 'string' &&
          recordValue.startsWith(filterValue)
        );
      case '$ends':
        return (
          typeof recordValue === 'string' &&
          typeof filterValue === 'string' &&
          recordValue.endsWith(filterValue)
        );
      case '$contains':
        return (
          typeof recordValue === 'string' &&
          typeof filterValue === 'string' &&
          recordValue.includes(filterValue)
        );
      case '$exists':
        return filterValue
          ? recordValue !== undefined && recordValue !== null
          : recordValue === undefined || recordValue === null;
      default:
        return true;
    }
  });
}

/**
 * $nearオペレータを検出する
 *
 * フィルター条件から$nearオペレータを検出し、NearQuery形式に変換します。
 *
 * @param filter - フィルター条件
 * @returns $nearクエリとフィールド名、または検出されなかった場合はnull
 *
 * @example
 * ```typescript
 * // GeoJSON形式
 * const result = detectNearQuery({
 *   location: {
 *     $near: {
 *       $geometry: { type: 'Point', coordinates: [139.7671, 35.6812] },
 *       $maxDistance: 5000
 *     }
 *   }
 * });
 * // => { fieldName: 'location', nearQuery: { ... } }
 *
 * // 簡易形式
 * const result = detectNearQuery({
 *   location: {
 *     $near: { latitude: 35.6812, longitude: 139.7671, maxDistance: 5000 }
 *   }
 * });
 * // => { fieldName: 'location', nearQuery: { ... } }
 * ```
 */
export function detectNearQuery(
  filter?: Record<string, unknown>
): { fieldName: string; nearQuery: NearQuery } | null {
  if (!filter || Object.keys(filter).length === 0) {
    return null;
  }

  for (const [fieldName, value] of Object.entries(filter)) {
    // 値がオブジェクトで、$nearプロパティを持つ場合
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nearValue = (value as Record<string, unknown>).$near;
      if (nearValue && typeof nearValue === 'object') {
        return {
          fieldName,
          nearQuery: nearValue as NearQuery,
        };
      }
    }
  }

  return null;
}
