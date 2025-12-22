/**
 * Find操作の型定義
 */

import type { FindParams, FindResult } from '../../types.js';

/**
 * 解析済みフィルター条件
 */
export interface ParsedFilter {
  parsed: ParsedFilterField;
  value: unknown;
}

/**
 * フィルターフィールドの解析結果
 */
export interface ParsedFilterField {
  field: string;
  operator: string;
  type?: string;
}

/**
 * 最適化可能なフィルター条件
 */
export interface OptimizableFilter {
  parsed: ParsedFilterField;
  value: unknown;
}

/**
 * 正規化されたFind操作のパラメータ
 */
export interface NormalizedFindParams {
  sort: {
    field: string;
    order: 'ASC' | 'DESC';
  };
  pagination: {
    perPage: number;
    nextToken?: string;
  };
  parsedFilters: ParsedFilter[];
}

/**
 * Find操作のコンテキスト
 */
export interface FindContext {
  resource: string;
  params: FindParams;
  requestId: string;
  shadowConfig: any;
  sort: {
    field: string;
    order: 'ASC' | 'DESC';
  };
  pagination: {
    perPage: number;
    nextToken?: string;
  };
  parsedFilters: ParsedFilter[];
}

/**
 * クエリ実行結果
 */
export interface QueryExecutionResult {
  items: any[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  nextToken?: string;
}

// 既存の型をエクスポート
export type { FindParams, FindResult };