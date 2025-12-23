/**
 * シャドウレコードクエリの実装
 * 
 * sort.field != 'id'の場合の通常のシャドウレコードクエリを担当します。
 */

import { QueryCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { createLogger } from '../../../shared/index.js';
import { getDBClient, getTableName, executeDynamoDBOperation, extractCleanRecord } from '../../utils/dynamodb.js';
import { encodeNextToken, decodeNextToken } from '../../utils/pagination.js';
import type { FindResult, NormalizedFindParams, OptimizableFilter } from './types.js';
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

  logger.debug('Executing shadow query', {
    requestId,
    resource,
    sortField: sort.field,
    hasFilters: parsedFilters.length > 0,
  });

  // Query最適化: ソートフィールドと一致するフィルター条件を検出
  const optimizableFilter = findOptimizableFilter(sort.field, parsedFilters);

  // シャドウクエリを実行
  const shadowRecords = await executeShadowRecordQuery(
    resource,
    sort,
    perPage,
    nextToken,
    optimizableFilter,
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
    };
  }

  // 本体レコードを取得
  const mainRecords = await fetchMainRecords(resource, recordIds, requestId);

  // IDでマッピングを作成（順序を保持するため）
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
      if (seenIds.has(id)) {
        return false; // 既に処理済みのIDはスキップ
      }
      seenIds.add(id);
      return true;
    })
    .map((id) => recordMap.get(id))
    .filter((record): record is Record<string, unknown> => record !== undefined);

  // フィルター条件を適用（メモリ内フィルタリング）
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
  };
}

/**
 * シャドウレコードクエリを実行する
 * 
 * @param resource - リソース名
 * @param sort - ソート条件
 * @param perPage - ページサイズ
 * @param nextToken - 次ページトークン
 * @param optimizableFilter - 最適化可能なフィルター
 * @param requestId - リクエストID
 * @returns DynamoDBクエリ結果
 */
async function executeShadowRecordQuery(
  resource: string,
  sort: { field: string; order: 'ASC' | 'DESC' },
  perPage: number,
  nextToken: string | undefined,
  optimizableFilter: OptimizableFilter | undefined,
  _requestId: string
): Promise<any> {
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

  return await executeDynamoDBOperation(
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
        })
      ),
    'Query'
  );
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
    case 'eq':
      return {
        keyConditionExpression: 'PK = :pk AND begins_with(SK, :skValue)',
        expressionAttributeValues: {
          ...expressionAttributeValues,
          ':skValue': `${skValue}#id#`,
        },
      };
    case 'gt':
      return {
        keyConditionExpression: 'PK = :pk AND SK > :skValue',
        expressionAttributeValues: {
          ...expressionAttributeValues,
          ':skValue': `${skValue}#id#~`,
        },
      };
    case 'gte':
      return {
        keyConditionExpression: 'PK = :pk AND SK >= :skValue',
        expressionAttributeValues: {
          ...expressionAttributeValues,
          ':skValue': `${skValue}#id#`,
        },
      };
    case 'lt':
      return {
        keyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix) AND SK < :skValue',
        expressionAttributeValues: {
          ...expressionAttributeValues,
          ':skPrefix': `${sortField}#`,
          ':skValue': `${skValue}#id#`,
        },
      };
    case 'lte':
      return {
        keyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix) AND SK <= :skValue',
        expressionAttributeValues: {
          ...expressionAttributeValues,
          ':skPrefix': `${sortField}#`,
          ':skValue': `${skValue}#id#~`,
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
    return String(value).padStart(20, '0');
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
function extractRecordIds(shadowRecords: any[]): string[] {
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
 * @param requestId - リクエストID
 * @returns 本体レコードの配列
 */
async function fetchMainRecords(
  resource: string,
  recordIds: string[],
  requestId: string
): Promise<any[]> {
  const dbClient = getDBClient();
  const tableName = getTableName();

  // 重複を除去
  const uniqueRecordIds = Array.from(new Set(recordIds));

  // 本体レコードをBatchGetItemで取得
  const batchGetResult = await executeDynamoDBOperation(
    () =>
      dbClient.send(
        new BatchGetCommand({
          RequestItems: {
            [tableName]: {
              Keys: uniqueRecordIds.map((id) => ({
                PK: resource,
                SK: `id#${id}`,
              })),
              ConsistentRead: true,
            },
          },
        })
      ),
    'BatchGetItem'
  );

  const mainRecords = batchGetResult.Responses?.[tableName] || [];

  logger.debug('Main records fetched', {
    requestId,
    resource,
    requestedCount: uniqueRecordIds.length,
    fetchedCount: mainRecords.length,
  });

  return mainRecords;
}