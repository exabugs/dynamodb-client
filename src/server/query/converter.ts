/**
 * クエリ変換ユーティリティ
 *
 * MongoDB風のFilterをDynamoDB形式に変換します。
 *
 * 要件: 8.5
 */
import type { Filter, FilterOperators } from '../../types.js';

/**
 * DynamoDB比較演算子
 */
export type DynamoComparisonOperator =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'nin'
  | 'exists'
  | 'begins_with'
  | 'contains';

/**
 * DynamoDB条件
 */
export interface DynamoCondition {
  /** フィールド名 */
  field: string;
  /** 比較演算子 */
  operator: DynamoComparisonOperator;
  /** 比較値 */
  value: unknown;
}

/**
 * DynamoDBクエリ
 */
export interface DynamoQuery {
  /** パーティションキー（リソース名） */
  pk: string;
  /** 条件の配列 */
  conditions: DynamoCondition[];
  /** 論理演算子（デフォルト: AND） */
  logicalOperator?: 'AND' | 'OR';
}

/**
 * FilterをDynamoDB形式に変換する
 *
 * MongoDB風のFilter構文をDynamoDBのFilterExpression用の条件配列に変換します。
 *
 * @example
 * ```typescript
 * // 単純な等価条件
 * const filter: Filter<Product> = { status: 'active' };
 * const query = convertFilterToDynamo('products', filter);
 * // => { pk: 'products', conditions: [{ field: 'status', operator: 'eq', value: 'active' }] }
 *
 * // 演算子を使用した条件
 * const filter: Filter<Product> = {
 *   price: { gte: 1000, lte: 5000 },
 *   status: { in: ['active', 'pending'] }
 * };
 * const query = convertFilterToDynamo('products', filter);
 * // => {
 * //   pk: 'products',
 * //   conditions: [
 * //     { field: 'price', operator: 'gte', value: 1000 },
 * //     { field: 'price', operator: 'lte', value: 5000 },
 * //     { field: 'status', operator: 'in', value: ['active', 'pending'] }
 * //   ]
 * // }
 *
 * // OR条件
 * const filter: Filter<Product> = {
 *   or: [
 *     { status: 'active' },
 *     { priority: { gte: 5 } }
 *   ]
 * };
 * const query = convertFilterToDynamo('products', filter);
 * // => {
 * //   pk: 'products',
 * //   conditions: [
 * //     { field: 'status', operator: 'eq', value: 'active' },
 * //     { field: 'priority', operator: 'gte', value: 5 }
 * //   ],
 * //   logicalOperator: 'OR'
 * // }
 * ```
 *
 * @param collection - コレクション名（リソース名）
 * @param filter - MongoDB風のフィルタ条件
 * @returns DynamoDBクエリ
 */
export function convertFilterToDynamo<T = any>(collection: string, filter: Filter<T>): DynamoQuery {
  const conditions: DynamoCondition[] = [];
  let logicalOperator: 'AND' | 'OR' = 'AND';

  // フィルタが空の場合
  if (!filter || Object.keys(filter).length === 0) {
    return { pk: collection, conditions };
  }

  // 論理演算子の処理
  if ('and' in filter && Array.isArray(filter.and)) {
    // AND条件: 各フィルタを再帰的に変換して結合
    for (const subFilter of filter.and) {
      const subQuery = convertFilterToDynamo(collection, subFilter);
      conditions.push(...subQuery.conditions);
    }
    logicalOperator = 'AND';
  } else if ('or' in filter && Array.isArray(filter.or)) {
    // OR条件: 各フィルタを再帰的に変換して結合
    for (const subFilter of filter.or) {
      const subQuery = convertFilterToDynamo(collection, subFilter);
      conditions.push(...subQuery.conditions);
    }
    logicalOperator = 'OR';
  }

  // 通常のフィールド条件を処理
  for (const [key, value] of Object.entries(filter)) {
    // 論理演算子はスキップ
    if (key === 'and' || key === 'or') {
      continue;
    }

    // 値がnullまたはundefinedの場合はスキップ
    if (value === null || value === undefined) {
      continue;
    }

    // FilterOperatorsオブジェクトかどうかをチェック
    if (isFilterOperators(value)) {
      // 演算子を使用した条件
      for (const [op, opValue] of Object.entries(value)) {
        if (opValue === undefined) continue;

        const operator = mapOperatorToDynamo(op as keyof FilterOperators<any>);
        conditions.push({
          field: key,
          operator,
          value: opValue,
        });
      }
    } else {
      // 直接値を指定した場合は等価条件として扱う
      conditions.push({
        field: key,
        operator: 'eq',
        value,
      });
    }
  }

  return {
    pk: collection,
    conditions,
    ...(logicalOperator === 'OR' && { logicalOperator }),
  };
}

/**
 * 値がFilterOperatorsオブジェクトかどうかをチェックする
 *
 * @param value - チェック対象の値
 * @returns FilterOperatorsオブジェクトの場合true
 */
function isFilterOperators(value: unknown): value is FilterOperators<any> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const validOperators = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'exists', 'regex'];
  const keys = Object.keys(value);

  // 少なくとも1つの有効な演算子キーを持つ場合はFilterOperatorsとみなす
  return keys.some((key) => validOperators.includes(key));
}

/**
 * MongoDB風の演算子をDynamoDB演算子にマッピングする
 *
 * @param operator - MongoDB風の演算子
 * @returns DynamoDB演算子
 */
function mapOperatorToDynamo(operator: keyof FilterOperators<any>): DynamoComparisonOperator {
  switch (operator) {
    case 'eq':
      return 'eq';
    case 'ne':
      return 'ne';
    case 'gt':
      return 'gt';
    case 'gte':
      return 'gte';
    case 'lt':
      return 'lt';
    case 'lte':
      return 'lte';
    case 'in':
      return 'in';
    case 'nin':
      return 'nin';
    case 'exists':
      return 'exists';
    case 'regex':
      // 正規表現は部分一致（contains）として扱う（簡易実装）
      return 'contains';
    default:
      return 'eq';
  }
}
