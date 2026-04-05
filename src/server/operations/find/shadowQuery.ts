/**
 * シャドウレコードクエリの実装
 *
 * sort.field != 'id'の場合の通常のシャドウレコードクエリを担当します。
 */
import { BatchGetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

import { NUMBER_FORMAT } from '../../../shared/constants/formatting.js';
import { createLogger } from '../../../shared/index.js';
import { CostTracker } from '../../utils/cost-tracker.js';
import {
  executeDynamoDBOperation,
  extractCleanRecord,
  getDBClient,
  getTableName,
} from '../../utils/dynamodb.js';
import {
  decodeNextToken,
  decodeOffsetToken,
  encodeNextToken,
  encodeOffsetToken,
} from '../../utils/pagination.js';
import type { FindResult, NormalizedFindParams, OptimizableFilter, ParsedFilter } from './types.js';
import { findOptimizableFilter, matchesAllFilters } from './utils.js';

const logger = createLogger({
  service: 'shadow-query',
  level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
});

/**
 * シャドウレコードクエリを実行する
 *
 * @param resource - リソース名
 * @param normalizedParams - 正規化されたパラメータ
 * @param requestId - リクエストID
 * @returns クエリ実行結果
 */
export async function executeShadowQuery(
  resource: string,
  normalizedParams: NormalizedFindParams,
  requestId: string
): Promise<FindResult> {
  const { sort, pagination, parsedFilters } = normalizedParams;
  const { perPage, nextToken } = pagination;
  const costTracker = new CostTracker();

  // Filter-first 戦略: $eq フィルタがある場合はそのシャドウインデックスで先に絞り込む
  // cardinality が指定されている場合は最も選択性の高いフィルタを優先
  // 指定がない場合は最初の $eq フィルタ（ソートフィールド以外）を使用
  const filterFirstCandidate = selectFilterFirstCandidate(parsedFilters, sort.field, normalizedParams.schema, perPage);

  const isFilterFirst = filterFirstCandidate !== undefined;

  // filter-first 戦略: フィルタシャドウで全件取得 → メモリソート → オフセットスライス
  if (isFilterFirst) {
    return executeFilterFirstQuery(
      resource,
      normalizedParams,
      filterFirstCandidate,
      costTracker,
      requestId
    );
  }

  // 通常戦略: ソートシャドウでページネーション取得
  const optimizableFilter = findOptimizableFilter(sort.field, parsedFilters);

  logger.debug('Executing shadow query', {
    requestId,
    resource,
    sortField: sort.field,
    isFilterFirst: false,
    hasFilters: parsedFilters.length > 0,
  });

  // シャドウクエリを実行
  const shadowRecords = await executeShadowRecordQuery(
    resource,
    sort,
    perPage,
    nextToken,
    optimizableFilter,
    costTracker,
    requestId
  );

  // シャドウレコードから本体レコードのIDを抽出
  const recordIds = extractRecordIds(shadowRecords.Items || []);

  if (recordIds.length === 0) {
    return {
      items: [],
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
      },
      consumedCapacity: costTracker.getAggregated(),
    };
  }

  // 本体レコードを取得
  const mainRecords = await fetchMainRecords(resource, recordIds, costTracker, requestId);

  // IDでマッピングを作成
  const recordMap = new Map(
    mainRecords.map((item) => {
      const data = item.data as Record<string, unknown>;
      return [data.id as string, extractCleanRecord(item)];
    })
  );

  // シャドーの順序でレコードを並べる（重複を除去）
  const seenIds = new Set<string>();
  let items = recordIds
    .filter((id) => {
      if (seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    })
    .map((id) => recordMap.get(id))
    .filter((record): record is Record<string, unknown> => record !== undefined);

  // 残りのフィルター条件を適用（メモリ内フィルタリング）
  if (parsedFilters.length > 0) {
    items = items.filter((record) => matchesAllFilters(record, parsedFilters));
  }

  // ページネーション情報を生成
  const hasNextPage =
    (shadowRecords.Items?.length || 0) < perPage
      ? false
      : shadowRecords.LastEvaluatedKey !== undefined;
  const nextTokenValue =
    hasNextPage && shadowRecords.LastEvaluatedKey
      ? encodeNextToken(
          shadowRecords.LastEvaluatedKey.PK as string,
          shadowRecords.LastEvaluatedKey.SK as string
        )
      : undefined;

  logger.info('Shadow query succeeded', {
    requestId,
    resource,
    sortField: sort.field,
    isFilterFirst: false,
    shadowCount: shadowRecords.Items?.length || 0,
    mainCount: items.length,
    hasNextPage,
  });

  return {
    items,
    pageInfo: {
      hasNextPage,
      hasPreviousPage: !!nextToken,
    },
    ...(nextTokenValue && { nextToken: nextTokenValue }),
    consumedCapacity: costTracker.getAggregated(),
  };
}

/**
 * filter-first クエリを実行する
 *
 * フィルタシャドウインデックスで全件取得 → メモリソート → オフセットスライス
 * ページネーションはオフセットベース（nextToken に offset を埋め込む）
 */
async function executeFilterFirstQuery(
  resource: string,
  normalizedParams: NormalizedFindParams,
  filterCandidate: ParsedFilter,
  costTracker: CostTracker,
  requestId: string
): Promise<FindResult> {
  const { sort, pagination, parsedFilters } = normalizedParams;
  const { perPage, nextToken } = pagination;

  // nextToken からオフセットを復元（filter-first 用オフセットトークン）
  const offset = nextToken ? (decodeOffsetToken(nextToken) ?? 0) : 0;

  const filterSort = { field: filterCandidate.parsed.field, order: 'ASC' as const };
  const remainingFilters = parsedFilters.filter((f) => f !== filterCandidate);

  logger.debug('Executing filter-first query', {
    requestId,
    resource,
    filterField: filterCandidate.parsed.field,
    sortField: sort.field,
    offset,
  });

  // フィルタシャドウインデックスから全件取得（Limit なし・全ページループ）
  const allShadowItems: Record<string, unknown>[] = [];
  let lastKey: Record<string, string> | undefined;
  do {
    const result = await executeShadowRecordQuery(
      resource,
      filterSort,
      1000, // 大きめの Limit でループ回数を最小化
      lastKey
        ? encodeNextToken(lastKey.PK as string, lastKey.SK as string)
        : undefined,
      filterCandidate as OptimizableFilter,
      costTracker,
      requestId
    );
    allShadowItems.push(...(result.Items || []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  // ID 抽出（重複除去）
  const allIds = Array.from(new Set(extractRecordIds(allShadowItems)));

  if (allIds.length === 0) {
    return {
      items: [],
      pageInfo: { hasNextPage: false, hasPreviousPage: offset > 0 },
      consumedCapacity: costTracker.getAggregated(),
    };
  }

  // 本体レコードを一括取得
  const mainRecords = await fetchMainRecords(resource, allIds, costTracker, requestId);
  const recordMap = new Map(
    mainRecords.map((item) => {
      const data = item.data as Record<string, unknown>;
      return [data.id as string, extractCleanRecord(item)];
    })
  );

  // ID 順に並べ、残りフィルタ適用
  let items = allIds
    .map((id) => recordMap.get(id))
    .filter((r): r is Record<string, unknown> => r !== undefined);

  if (remainingFilters.length > 0) {
    items = items.filter((r) => matchesAllFilters(r, remainingFilters));
  }

  // ソートフィールドでメモリソート（全件）
  items = sortInMemory(items, sort);

  // オフセットでスライス
  const page = items.slice(offset, offset + perPage);
  const hasNextPage = offset + perPage < items.length;
  const nextTokenValue = hasNextPage ? encodeOffsetToken(offset + perPage) : undefined;

  logger.info('Filter-first query succeeded', {
    requestId,
    resource,
    filterField: filterCandidate.parsed.field,
    sortField: sort.field,
    totalMatched: items.length,
    offset,
    returned: page.length,
    hasNextPage,
  });

  return {
    items: page,
    pageInfo: { hasNextPage, hasPreviousPage: offset > 0 },
    ...(nextTokenValue && { nextToken: nextTokenValue }),
    consumedCapacity: costTracker.getAggregated(),
  };
}

/**
 * filter-first で使うフィルタ候補を選択する
 *
 * 閾値: cardinality > perPage/2 のフィールドのみ filter-first 対象
 *   例: perPage=50, prefecture=47 → 47 > 25 → filter-first 有利
 *       perPage=50, status=3      →  3 > 25 → 対象外（sort-first の方が効率的）
 *
 * cardinality 未指定の場合: 閾値チェックなしで最初の $eq フィルタを使用
 *
 * @param parsedFilters - 解析済みフィルタ
 * @param sortField - ソートフィールド（これと一致するフィルタは最適化済みのため除外）
 * @param schema - リソーススキーマ（カーディナリティヒント）
 * @param perPage - ページサイズ（閾値として使用）
 */
function selectFilterFirstCandidate(
  parsedFilters: ParsedFilter[],
  sortField: string,
  schema: NormalizedFindParams['schema'],
  perPage: number
): ParsedFilter | undefined {
  const eqFilters = parsedFilters.filter(
    (f) => f.parsed.operator === '$eq' && f.parsed.field !== sortField
  );

  if (eqFilters.length === 0) return undefined;

  const cardinality = schema?.cardinality;
  if (!cardinality) {
    // schema なし: filter-first 無効（カーディナリティ不明では効率が保証できない）
    return undefined;
  }

  // cardinality > 0 のフィールドを対象に、最も高いものを優先
  // 閾値は perPage の半分: sort-first より filter-first が有利になる目安
  // （全レコード数 / cardinality < perPage/2 → filter-first が効率的）
  const threshold = perPage / 2;
  const scored = eqFilters
    .map((f) => ({ f, score: cardinality[f.parsed.field] ?? 0 }))
    .filter(({ score }) => score > threshold)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.f;
}

/**
 * レコードをメモリ内でソートする（filter-first 後のソート用）
 *
 * @param items - ソート対象レコード
 * @param sort - ソート条件
 * @returns ソート済みレコード
 */
function sortInMemory(
  items: Record<string, unknown>[],
  sort: { field: string; order: 'ASC' | 'DESC' }
): Record<string, unknown>[] {
  const { field, order } = sort;
  const direction = order === 'ASC' ? 1 : -1;

  return [...items].sort((a, b) => {
    const aVal = a[field];
    const bVal = b[field];

    if (aVal === undefined || aVal === null) return direction;
    if (bVal === undefined || bVal === null) return -direction;

    if (aVal < bVal) return -direction;
    if (aVal > bVal) return direction;
    return 0;
  });
}

/**
 * シャドウレコードクエリを実行する
 *
 * @param resource - リソース名
 * @param sort - ソート条件
 * @param perPage - ページサイズ
 * @param nextToken - 次ページトークン
 * @param optimizableFilter - 最適化可能なフィルター
 * @param costTracker - コスト追跡インスタンス
 * @param requestId - リクエストID
 * @returns DynamoDBクエリ結果
 */
async function executeShadowRecordQuery(
  resource: string,
  sort: { field: string; order: 'ASC' | 'DESC' },
  perPage: number,
  nextToken: string | undefined,
  optimizableFilter: OptimizableFilter | undefined,
  costTracker: CostTracker,
  _requestId: string
): Promise<{
  Items?: Record<string, unknown>[];
  LastEvaluatedKey?: Record<string, string>;
}> {
  const dbClient = getDBClient();
  const tableName = getTableName();

  // ExclusiveStartKeyの設定
  let exclusiveStartKey: Record<string, string> | undefined;
  if (nextToken) {
    const decoded = decodeNextToken(nextToken);
    exclusiveStartKey = {
      PK: decoded.PK,
      SK: decoded.SK,
    };
  }

  // KeyConditionExpressionを構築
  const { keyConditionExpression, expressionAttributeValues } = buildKeyCondition(
    resource,
    sort.field,
    optimizableFilter
  );

  const result = await executeDynamoDBOperation(
    () =>
      dbClient.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: keyConditionExpression,
          ExpressionAttributeValues: expressionAttributeValues,
          ScanIndexForward: sort.order === 'ASC',
          Limit: perPage,
          ExclusiveStartKey: exclusiveStartKey,
          ConsistentRead: true,
          ReturnConsumedCapacity: 'TOTAL',
        })
      ),
    'Query'
  );

  // コスト情報を収集
  costTracker.add(result.ConsumedCapacity);

  return result;
}

/**
 * KeyConditionExpressionを構築する
 *
 * @param resource - リソース名
 * @param sortField - ソートフィールド
 * @param optimizableFilter - 最適化可能なフィルター
 * @returns KeyConditionExpressionと属性値
 */
function buildKeyCondition(
  resource: string,
  sortField: string,
  optimizableFilter: OptimizableFilter | undefined
): {
  keyConditionExpression: string;
  expressionAttributeValues: Record<string, unknown>;
} {
  const expressionAttributeValues: Record<string, unknown> = {
    ':pk': resource,
  };

  if (!optimizableFilter) {
    // 最適化なし: プレフィックスマッチ
    return {
      keyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      expressionAttributeValues: {
        ...expressionAttributeValues,
        ':skPrefix': `${sortField}#`,
      },
    };
  }

  // 最適化あり: フィルター条件をKeyConditionExpressionに含める
  const { operator, type } = optimizableFilter.parsed;
  const value = optimizableFilter.value;

  // 値をシャドーSK形式にエンコード
  const encodedValue = encodeValueForShadowSK(value, type);
  const skValue = `${sortField}#${encodedValue}`;

  switch (operator) {
    case '$eq':
      return {
        keyConditionExpression: 'PK = :pk AND begins_with(SK, :skValue)',
        expressionAttributeValues: {
          ...expressionAttributeValues,
          ':skValue': `${skValue}#id#`,
        },
      };
    case '$gt':
      return {
        keyConditionExpression: 'PK = :pk AND SK > :skValue',
        expressionAttributeValues: {
          ...expressionAttributeValues,
          ':skValue': `${skValue}#id#~`,
        },
      };
    case '$gte':
      return {
        keyConditionExpression: 'PK = :pk AND SK >= :skValue',
        expressionAttributeValues: {
          ...expressionAttributeValues,
          ':skValue': `${skValue}#id#`,
        },
      };
    case '$lt':
      return {
        keyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix) AND SK < :skValue',
        expressionAttributeValues: {
          ...expressionAttributeValues,
          ':skPrefix': `${sortField}#`,
          ':skValue': `${skValue}#id#`,
        },
      };
    case '$lte':
      return {
        keyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix) AND SK <= :skValue',
        expressionAttributeValues: {
          ...expressionAttributeValues,
          ':skPrefix': `${sortField}#`,
          ':skValue': `${skValue}#id#~`,
        },
      };
    case '$starts':
      // プレフィックスマッチ: begins_with(SK, '{sortField}#{prefix}')
      // 例: typeDate: { $starts: 'day:2026-03-14:' }
      //   → begins_with(SK, 'typeDate#day:2026-03-14:')
      return {
        keyConditionExpression: 'PK = :pk AND begins_with(SK, :skValue)',
        expressionAttributeValues: {
          ...expressionAttributeValues,
          ':skValue': skValue,
        },
      };
    default:
      // 未対応の演算子の場合はプレフィックスマッチにフォールバック
      return {
        keyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        expressionAttributeValues: {
          ...expressionAttributeValues,
          ':skPrefix': `${sortField}#`,
        },
      };
  }
}

/**
 * 値をシャドーSK形式にエンコードする
 *
 * @param value - エンコードする値
 * @param type - 値の型
 * @returns エンコードされた値
 */
function encodeValueForShadowSK(value: unknown, type?: string): string {
  if (type === 'number') {
    return String(value).padStart(NUMBER_FORMAT.SHADOW_SK_DIGITS, NUMBER_FORMAT.ZERO_PAD_CHAR);
  } else if (type === 'date') {
    return new Date(String(value)).toISOString();
  } else if (type === 'boolean') {
    return String(value);
  } else {
    // string型: エスケープ処理（# → ##、スペース → #）
    return String(value).replace(/#/g, '##').replace(/ /g, '#');
  }
}

/**
 * シャドウレコードから本体レコードのIDを抽出する
 *
 * @param shadowRecords - シャドウレコードの配列
 * @returns レコードIDの配列
 */
function extractRecordIds(shadowRecords: Record<string, unknown>[]): string[] {
  return shadowRecords
    .map((record) => {
      const sk = record.SK as string;
      // SK形式: {field}#{value}#id#{recordId}
      const parts = sk.split('#id#');
      return parts.length > 1 ? parts[1] : null;
    })
    .filter((id): id is string => id !== null);
}

/**
 * 本体レコードを取得する
 *
 * @param resource - リソース名
 * @param recordIds - レコードIDの配列
 * @param costTracker - コスト追跡インスタンス
 * @param requestId - リクエストID
 * @returns 本体レコードの配列
 */
async function fetchMainRecords(
  resource: string,
  recordIds: string[],
  costTracker: CostTracker,
  requestId: string
): Promise<Record<string, unknown>[]> {
  const dbClient = getDBClient();
  const tableName = getTableName();

  // 重複を除去
  const uniqueRecordIds = Array.from(new Set(recordIds));

  // DynamoDB BatchGetItem は最大100件/リクエスト
  const BATCH_SIZE = 100;
  const allRecords: Record<string, unknown>[] = [];

  for (let i = 0; i < uniqueRecordIds.length; i += BATCH_SIZE) {
    const chunk = uniqueRecordIds.slice(i, i + BATCH_SIZE);

    const batchGetResult = await executeDynamoDBOperation(
      () =>
        dbClient.send(
          new BatchGetCommand({
            RequestItems: {
              [tableName]: {
                Keys: chunk.map((id) => ({
                  PK: resource,
                  SK: `id#${id}`,
                })),
                ConsistentRead: true,
              },
            },
            ReturnConsumedCapacity: 'TOTAL',
          })
        ),
      'BatchGetItem'
    );

    // コスト情報を収集
    if (batchGetResult.ConsumedCapacity) {
      for (const capacity of batchGetResult.ConsumedCapacity) {
        costTracker.add(capacity);
      }
    }

    allRecords.push(...(batchGetResult.Responses?.[tableName] || []));
  }

  logger.debug('Main records fetched', {
    requestId,
    resource,
    requestedCount: uniqueRecordIds.length,
    fetchedCount: allRecords.length,
  });

  return allRecords;
}
