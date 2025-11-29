/**
 * DynamoDB フィルター式生成ユーティリティ
 * FilterExpression の構築とシャドーレコード除外条件の生成
 *
 * 要件: 5.5, 7.1, 12.1-12.12
 */

/**
 * フィルター演算子
 *
 * 要件: 12.2
 */
export type FilterOperator = 'eq' | 'lt' | 'lte' | 'gt' | 'gte' | 'starts' | 'ends';

/**
 * フィルター型
 *
 * 要件: 12.5
 */
export type FilterType = 'string' | 'number' | 'date' | 'boolean';

/**
 * パース済みフィルターフィールド
 *
 * 要件: 12.1
 */
export interface ParsedFilterField {
  /** 実際のフィールド名 */
  field: string;
  /** 演算子 */
  operator: FilterOperator;
  /** データ型 */
  type: FilterType;
}

/**
 * フィルター式の構築結果
 */
export interface FilterExpressionResult {
  /** FilterExpression 文字列 */
  expression: string;
  /** ExpressionAttributeNames マッピング */
  names: Record<string, string>;
  /** ExpressionAttributeValues マッピング */
  values: Record<string, unknown>;
}

/**
 * フィルターフィールド名をパースする
 *
 * フォーマット: `フィールド名:オペレータ:型`
 * - オペレータ省略時: eq（デフォルト）
 * - 型省略時: string（デフォルト）
 *
 * 例:
 * - "status" → { field: "status", operator: "eq", type: "string" }
 * - "priority:gte" → { field: "priority", operator: "gte", type: "string" }
 * - "priority:gte:number" → { field: "priority", operator: "gte", type: "number" }
 *
 * 要件: 12.1, 12.3, 12.4
 *
 * @param fieldKey - フィルターフィールド名
 * @returns パース結果
 * @throws Error - 構文エラーの場合
 */
export function parseFilterField(fieldKey: string): ParsedFilterField {
  const parts = fieldKey.split(':');

  if (parts.length === 1) {
    // "status" → { field: "status", operator: "eq", type: "string" }
    return { field: parts[0], operator: 'eq', type: 'string' };
  }

  if (parts.length === 2) {
    // "priority:gte" → { field: "priority", operator: "gte", type: "string" }
    const operator = parts[1] as FilterOperator;
    if (!isValidOperator(operator)) {
      throw new Error(`Invalid filter operator: ${parts[1]}`);
    }
    return { field: parts[0], operator, type: 'string' };
  }

  if (parts.length === 3) {
    // "priority:gte:number" → { field: "priority", operator: "gte", type: "number" }
    const operator = parts[1] as FilterOperator;
    const type = parts[2] as FilterType;

    if (!isValidOperator(operator)) {
      throw new Error(`Invalid filter operator: ${parts[1]}`);
    }
    if (!isValidType(type)) {
      throw new Error(`Invalid filter type: ${parts[2]}`);
    }

    return { field: parts[0], operator, type };
  }

  throw new Error(`Invalid filter field syntax: ${fieldKey}`);
}

/**
 * 演算子が有効かチェックする
 */
function isValidOperator(operator: string): operator is FilterOperator {
  return ['eq', 'lt', 'lte', 'gt', 'gte', 'starts', 'ends'].includes(operator);
}

/**
 * 型が有効かチェックする
 */
function isValidType(type: string): type is FilterType {
  return ['string', 'number', 'date', 'boolean'].includes(type);
}

/**
 * シャドーレコードを除外するフィルター式を生成する
 *
 * シャドーレコードの特徴:
 * - SK に '#' が含まれる（例: "name#value#id#ULID"）
 * - 本体レコードは "id#ULID" 形式で '#' が1つのみ
 *
 * 除外条件:
 * - attribute_exists(data) AND NOT contains(SK, '#id#')
 *
 * @returns シャドー除外フィルター式
 */
export function createShadowExclusionFilter(): FilterExpressionResult {
  return {
    expression: 'attribute_exists(#data) AND NOT contains(#sk, :shadowMarker)',
    names: {
      '#data': 'data',
      '#sk': 'SK',
    },
    values: {
      ':shadowMarker': '#id#',
    },
  };
}

/**
 * ユーザー指定のフィルター条件から FilterExpression を構築する
 *
 * 注意: この実装は基本的な等価比較のみをサポート
 * より複雑な条件（範囲検索、部分一致など）は将来の拡張として実装可能
 *
 * @param filter - フィルター条件（キー: フィールド名、値: 期待値）
 * @returns フィルター式の構築結果
 */
export function buildFilterExpression(
  filter: Record<string, unknown>
): FilterExpressionResult | null {
  const entries = Object.entries(filter);

  // フィルター条件が空の場合は null を返す
  if (entries.length === 0) {
    return null;
  }

  const expressions: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};

  entries.forEach(([key, value], index) => {
    const nameKey = `#field${index}`;
    const valueKey = `:value${index}`;

    // data.{field} = :value 形式の条件を生成
    expressions.push(`#data.${nameKey} = ${valueKey}`);
    names['#data'] = 'data';
    names[nameKey] = key;
    values[valueKey] = value;
  });

  return {
    expression: expressions.join(' AND '),
    names,
    values,
  };
}

/**
 * 複数のフィルター式を AND 条件で結合する
 *
 * @param filters - 結合するフィルター式の配列
 * @returns 結合されたフィルター式
 */
export function combineFilters(
  filters: (FilterExpressionResult | null)[]
): FilterExpressionResult | null {
  // null を除外
  const validFilters = filters.filter((f): f is FilterExpressionResult => f !== null);

  if (validFilters.length === 0) {
    return null;
  }

  if (validFilters.length === 1) {
    return validFilters[0];
  }

  // 式を AND で結合
  const expression = validFilters.map((f) => `(${f.expression})`).join(' AND ');

  // names と values をマージ
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};

  validFilters.forEach((f) => {
    Object.assign(names, f.names);
    Object.assign(values, f.values);
  });

  return {
    expression,
    names,
    values,
  };
}

/**
 * フィルター式を DynamoDB Query/Scan パラメータに適用する
 *
 * @param params - DynamoDB Query/Scan パラメータ
 * @param filter - フィルター式
 * @returns フィルター式が適用されたパラメータ
 */
export function applyFilterExpression<T extends Record<string, unknown>>(
  params: T,
  filter: FilterExpressionResult | null
): T {
  if (!filter) {
    return params;
  }

  return {
    ...params,
    FilterExpression: filter.expression,
    ExpressionAttributeNames: {
      ...(params.ExpressionAttributeNames as Record<string, string> | undefined),
      ...filter.names,
    },
    ExpressionAttributeValues: {
      ...(params.ExpressionAttributeValues as Record<string, unknown> | undefined),
      ...filter.values,
    },
  };
}

/**
 * 型変換ヘルパー
 *
 * 要件: 12.5
 *
 * @param value - 変換する値
 * @param type - 変換先の型
 * @returns 変換後の値
 */
export function convertType(value: unknown, type: FilterType): string | number | Date | boolean {
  switch (type) {
    case 'string':
      return String(value);
    case 'number':
      return Number(value);
    case 'date':
      return new Date(String(value));
    case 'boolean':
      // 文字列 "true"/"false" または boolean値を処理
      if (typeof value === 'boolean') return value;
      return String(value).toLowerCase() === 'true';
    default:
      return String(value);
  }
}

/**
 * レコードが単一のフィルター条件に一致するかチェックする
 *
 * 要件: 12.2, 12.6, 12.8, 12.9
 *
 * @param record - チェック対象レコード
 * @param parsed - パース済みフィルター条件
 * @param value - フィルター値
 * @returns 一致する場合true
 */
export function matchesFilter(
  record: Record<string, unknown>,
  parsed: ParsedFilterField,
  value: unknown
): boolean {
  const fieldValue = record[parsed.field];

  // フィールドが存在しない場合は不一致
  if (fieldValue === undefined || fieldValue === null) {
    return false;
  }

  // 型変換
  const typedFieldValue = convertType(fieldValue, parsed.type);
  const typedFilterValue = convertType(value, parsed.type);

  // 演算子に応じた比較
  switch (parsed.operator) {
    case 'eq':
      return typedFieldValue === typedFilterValue;
    case 'lt':
      return typedFieldValue < typedFilterValue;
    case 'lte':
      return typedFieldValue <= typedFilterValue;
    case 'gt':
      return typedFieldValue > typedFilterValue;
    case 'gte':
      return typedFieldValue >= typedFilterValue;
    case 'starts':
      return String(typedFieldValue).startsWith(String(typedFilterValue));
    case 'ends':
      return String(typedFieldValue).endsWith(String(typedFilterValue));
    default:
      return false;
  }
}

/**
 * レコードがすべてのフィルター条件に一致するかチェックする（AND条件）
 *
 * 要件: 12.9
 *
 * @param record - チェック対象レコード
 * @param parsedFilters - パース済みフィルター条件の配列
 * @returns すべての条件に一致する場合true
 */
export function matchesAllFilters(
  record: Record<string, unknown>,
  parsedFilters: Array<{ parsed: ParsedFilterField; value: unknown }>
): boolean {
  return parsedFilters.every((f) => matchesFilter(record, f.parsed, f.value));
}

/**
 * Query最適化が可能かチェックする
 *
 * ソートフィールドと一致し、Query可能な演算子を持つフィルター条件を検出する
 *
 * 要件: 12.7
 *
 * @param sortField - ソート対象フィールド
 * @param parsedFilters - パース済みフィルター条件
 * @returns 最適化可能なフィルター条件（なければnull）
 */
export function findOptimizableFilter(
  sortField: string,
  parsedFilters: Array<{ parsed: ParsedFilterField; value: unknown }>
): { parsed: ParsedFilterField; value: unknown } | null {
  // Query可能な演算子
  const queryableOperators: FilterOperator[] = ['eq', 'lt', 'lte', 'gt', 'gte', 'starts'];

  // ソートフィールドと一致し、Query可能な演算子を持つフィルターを探す
  return (
    parsedFilters.find(
      (f) => f.parsed.field === sortField && queryableOperators.includes(f.parsed.operator)
    ) || null
  );
}
