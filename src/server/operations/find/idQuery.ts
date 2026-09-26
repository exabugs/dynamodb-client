/**
 * ID最適化クエリの実装
 *
 * sort.field='id'の場合の特別な処理を担当します。
 */
import { QueryCommand } from '@aws-sdk/lib-dynamodb';

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
import type { FindResult, NormalizedFindParams, ParsedFilter } from './types.js';
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
  if (idFilter && idFilter.parsed.operator === '$eq') {
    return await executeSpecificIdQuery(resource, String(idFilter.value), requestId);
  }

  // $in フィルターがある場合は各IDを個別取得（ページネーションで欠落しないように）
  if (idFilter && idFilter.parsed.operator === '$in' && Array.isArray(idFilter.value)) {
    return await executeInQuery(resource, idFilter.value.map(String), sort, requestId);
  }

  // 全レコード取得の場合の処理
  return await executeAllRecordsQuery(resource, sort, perPage, nextToken, parsedFilters, requestId);
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
  const costTracker = new CostTracker();

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
          ReturnConsumedCapacity: 'TOTAL',
        })
      ),
    'Query'
  );

  // コスト情報を収集
  costTracker.add(queryResult.ConsumedCapacity);

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
    consumedCapacity: costTracker.getAggregated(),
  };
}

/**
 * 複数IDのレコードを個別取得する（$in クエリ用）
 *
 * ページネーションで欠落しないよう、各IDを個別にQueryで取得する。
 */
async function executeInQuery(
  resource: string,
  targetIds: string[],
  sort: { field: string; order: 'ASC' | 'DESC' },
  requestId: string
): Promise<FindResult> {
  const dbClient = getDBClient();
  const tableName = getTableName();
  const costTracker = new CostTracker();

  const results = await Promise.all(
    targetIds.map((id) =>
      executeDynamoDBOperation(
        () =>
          dbClient.send(
            new QueryCommand({
              TableName: tableName,
              KeyConditionExpression: 'PK = :pk AND SK = :sk',
              ExpressionAttributeValues: {
                ':pk': resource,
                ':sk': `id#${id}`,
              },
              ConsistentRead: true,
              ReturnConsumedCapacity: 'TOTAL',
            })
          ),
        'Query'
      ).then((result) => {
        costTracker.add(result.ConsumedCapacity);
        return result.Items || [];
      })
    )
  );

  let items = results.flat().map((item) => extractCleanRecord(item));

  // ソート適用
  items.sort((a, b) => {
    const aVal = String(a.id ?? '');
    const bVal = String(b.id ?? '');
    return sort.order === 'ASC' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
  });

  logger.info('ID $in query succeeded', {
    requestId,
    resource,
    requestedCount: targetIds.length,
    foundCount: items.length,
  });

  return {
    items,
    pageInfo: {
      hasNextPage: false,
      hasPreviousPage: false,
    },
    consumedCapacity: costTracker.getAggregated(),
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
  parsedFilters: ParsedFilter[],
  requestId: string
): Promise<FindResult> {
  // id フィルタ（$eq/$in）はこの関数に到達する前に別処理されているため、
  // ここに残るフィルタは全て id 以外のフィールドに対するもの＝KeyConditionExpression
  // では絞り込めない。Limit 付き単発クエリでは「取得した1ページの中にだけ」
  // フィルタが適用され、ページの外にある本来マッチすべきレコードが漏れてしまうため、
  // フィルタが1件でもあれば全件フルスキャン（Limitなしループ取得）にフォールバックする。
  if (parsedFilters.length > 0) {
    return executeAllRecordsQueryFullScan(resource, sort, perPage, nextToken, parsedFilters, requestId);
  }

  const dbClient = getDBClient();
  const tableName = getTableName();
  const costTracker = new CostTracker();

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
          ReturnConsumedCapacity: 'TOTAL',
        })
      ),
    'Query'
  );

  // コスト情報を収集
  costTracker.add(queryResult.ConsumedCapacity);

  const mainRecords = queryResult.Items || [];

  // レコードが0件の場合
  if (mainRecords.length === 0) {
    return {
      items: [],
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
      },
      consumedCapacity: costTracker.getAggregated(),
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
    consumedCapacity: costTracker.getAggregated(),
  };
}

/**
 * 全レコードを取得する（IDソート・フルスキャン版）
 *
 * id 以外のフィールドに対するフィルタ（KeyConditionExpression では絞り込めない）
 * がある場合のフォールバック経路。本体レコードを Limit なしで全件ループ取得し、
 * メモリ内で全フィルタ条件を適用してからオフセットベースでページングする。
 *
 * @param resource - リソース名
 * @param sort - ソート条件
 * @param perPage - ページサイズ
 * @param nextToken - 次ページトークン（オフセットベース）
 * @param parsedFilters - 解析済みフィルター条件
 * @param requestId - リクエストID
 * @returns クエリ実行結果
 */
async function executeAllRecordsQueryFullScan(
  resource: string,
  sort: { field: string; order: 'ASC' | 'DESC' },
  perPage: number,
  nextToken: string | undefined,
  parsedFilters: ParsedFilter[],
  requestId: string
): Promise<FindResult> {
  const dbClient = getDBClient();
  const tableName = getTableName();
  const costTracker = new CostTracker();

  // nextToken からオフセットを復元（フルスキャン用オフセットトークン）
  const offset = nextToken ? (decodeOffsetToken(nextToken) ?? 0) : 0;

  logger.debug('Executing full scan query (ID sort)', {
    requestId,
    resource,
    offset,
  });

  // 本体レコードを Limit なしで全件ループ取得
  const allRecords: Record<string, unknown>[] = [];
  let exclusiveStartKey: Record<string, string> | undefined;
  do {
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
            Limit: 1000, // 大きめの Limit でループ回数を最小化
            ExclusiveStartKey: exclusiveStartKey,
            ConsistentRead: true,
            ReturnConsumedCapacity: 'TOTAL',
          })
        ),
      'Query'
    );
    costTracker.add(queryResult.ConsumedCapacity);
    allRecords.push(...(queryResult.Items || []));
    exclusiveStartKey = queryResult.LastEvaluatedKey as Record<string, string> | undefined;
  } while (exclusiveStartKey);

  // クリーンなレコードに変換してフィルター適用
  let items = allRecords.map((item) => extractCleanRecord(item));
  items = items.filter((record) => matchesAllFilters(record, parsedFilters));

  // 取得順が既に sort 順（begins_with('id#')のScanIndexForward）のため、追加ソートは不要

  // オフセットでスライス
  const page = items.slice(offset, offset + perPage);
  const hasNextPage = offset + perPage < items.length;
  const nextTokenValue = hasNextPage ? encodeOffsetToken(offset + perPage) : undefined;

  logger.info('ID full scan query succeeded', {
    requestId,
    resource,
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
