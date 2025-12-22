/**
 * ID最適化クエリの実装
 * 
 * sort.field='id'の場合の特別な処理を担当します。
 */

import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { createLogger } from '../../../shared/index.js';
import { getDBClient, getTableName, executeDynamoDBOperation, extractCleanRecord } from '../../utils/dynamodb.js';
import { encodeNextToken, decodeNextToken } from '../../utils/pagination.js';
import type { FindResult, NormalizedFindParams } from './types.js';
import { matchesAllFilters } from './utils.js';

const logger = createLogger({
  service: 'id-query',
  level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
});

/**
 * ID最適化クエリを実行する
 * 
 * @param resource - リソース名
 * @param normalizedParams - 正規化されたパラメータ
 * @param requestId - リクエストID
 * @returns クエリ実行結果
 */
export async function executeIdQuery(
  resource: string,
  normalizedParams: NormalizedFindParams,
  requestId: string
): Promise<FindResult> {
  const { sort, pagination, parsedFilters } = normalizedParams;
  const { perPage, nextToken } = pagination;

  logger.debug('Executing ID optimized query', {
    requestId,
    resource,
    sort,
    hasFilters: parsedFilters.length > 0,
  });

  // 特定のIDフィルターがある場合の処理
  const idFilter = parsedFilters.find((f) => f.parsed.field === 'id');
  if (idFilter && idFilter.parsed.operator === 'eq') {
    return await executeSpecificIdQuery(resource, String(idFilter.value), requestId);
  }

  // 全レコード取得の場合の処理
  return await executeAllRecordsQuery(
    resource,
    sort,
    perPage,
    nextToken,
    parsedFilters,
    requestId
  );
}

/**
 * 特定のIDのレコードを取得する
 * 
 * @param resource - リソース名
 * @param targetId - 対象のID
 * @param requestId - リクエストID
 * @returns クエリ実行結果
 */
async function executeSpecificIdQuery(
  resource: string,
  targetId: string,
  requestId: string
): Promise<FindResult> {
  const dbClient = getDBClient();
  const tableName = getTableName();

  const queryResult = await executeDynamoDBOperation(
    () =>
      dbClient.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: 'PK = :pk AND SK = :sk',
          ExpressionAttributeValues: {
            ':pk': resource,
            ':sk': `id#${targetId}`,
          },
          ConsistentRead: true,
        })
      ),
    'Query'
  );

  const mainRecords = queryResult.Items || [];
  const items = mainRecords.map((item) => extractCleanRecord(item));

  logger.info('ID specific query succeeded', {
    requestId,
    resource,
    targetId,
    count: items.length,
  });

  return {
    items,
    pageInfo: {
      hasNextPage: false,
      hasPreviousPage: false,
    },
  };
}

/**
 * 全レコードを取得する（IDソート）
 * 
 * @param resource - リソース名
 * @param sort - ソート条件
 * @param perPage - ページサイズ
 * @param nextToken - 次ページトークン
 * @param parsedFilters - 解析済みフィルター条件
 * @param requestId - リクエストID
 * @returns クエリ実行結果
 */
async function executeAllRecordsQuery(
  resource: string,
  sort: { field: string; order: 'ASC' | 'DESC' },
  perPage: number,
  nextToken: string | undefined,
  parsedFilters: any[],
  requestId: string
): Promise<FindResult> {
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

  // 本体レコードを直接Queryで取得
  const queryResult = await executeDynamoDBOperation(
    () =>
      dbClient.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
          ExpressionAttributeValues: {
            ':pk': resource,
            ':skPrefix': 'id#',
          },
          ScanIndexForward: sort.order === 'ASC',
          Limit: perPage,
          ExclusiveStartKey: exclusiveStartKey,
          ConsistentRead: true,
        })
      ),
    'Query'
  );

  const mainRecords = queryResult.Items || [];

  // レコードが0件の場合
  if (mainRecords.length === 0) {
    return {
      items: [],
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };
  }

  // クリーンなレコードに変換
  let items = mainRecords.map((item) => extractCleanRecord(item));

  // フィルター条件を適用（メモリ内フィルタリング）
  if (parsedFilters.length > 0) {
    items = items.filter((record) => matchesAllFilters(record, parsedFilters));
  }

  // ページネーション情報を生成
  const hasNextPage =
    mainRecords.length < perPage ? false : queryResult.LastEvaluatedKey !== undefined;
  const nextTokenValue =
    hasNextPage && queryResult.LastEvaluatedKey
      ? encodeNextToken(
          queryResult.LastEvaluatedKey.PK as string,
          queryResult.LastEvaluatedKey.SK as string
        )
      : undefined;

  logger.info('ID all records query succeeded', {
    requestId,
    resource,
    count: items.length,
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