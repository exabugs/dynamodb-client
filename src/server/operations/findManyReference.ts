/**
 * findManyReference 操作
 * 参照レコード取得（外部キー指定）
 *
 * 要件: 4.3, 5.4, 5.5
 */
import { BatchGetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

import { ConfigError, createLogger, getResourceSchema, getShadowConfig } from '../../index.js';
import type { ShadowConfig } from '../shadow/index.js';
import type { FindManyReferenceParams, FindManyReferenceResult } from '../types.js';
import {
  executeDynamoDBOperation,
  extractCleanRecord,
  getDBClient,
  getTableName,
} from '../utils/dynamodb.js';
import { decodeNextToken, encodeNextToken } from '../utils/pagination.js';
import { normalizePagination, normalizeSort, validateSortField } from '../utils/validation.js';

const logger = createLogger({ service: 'records-lambda' });

/**
 * findManyReference 操作を実行する
 *
 * 処理フロー:
 * 1. シャドー設定を読み込み、ソートフィールドを検証
 * 2. シャドーレコードをQueryで取得（ソート済み）
 * 3. 本体レコードをBatchGetItemで取得
 * 4. target/idフィルターとユーザー指定フィルターを適用
 * 5. ページネーション情報を生成してレスポンスを返す
 *
 * @param resource - リソース名
 * @param params - findManyReferenceパラメータ
 * @param requestId - リクエストID
 * @returns リストデータ
 */
export async function handleFindManyReference(
  resource: string,
  params: FindManyReferenceParams,
  requestId: string
): Promise<FindManyReferenceResult> {
  const { target, id, filter, sort: sortParam, pagination } = params;

  logger.debug('Executing findManyReference', {
    requestId,
    resource,
    target,
    id,
  });

  // シャドー設定を取得（環境変数からキャッシュ付き）
  const shadowConfig = getShadowConfig();

  // ソート条件を正規化（デフォルト値を適用）
  const sort = normalizeSort(shadowConfig as ShadowConfig, resource, sortParam);

  // ソートフィールドを検証
  validateSortField(shadowConfig as ShadowConfig, resource, sort);

  // ページネーション条件を正規化
  const { perPage, nextToken } = normalizePagination(pagination);

  const dbClient = getDBClient();
  const tableName = getTableName();

  // シャドーフィールドの型情報を取得
  const shadowSchema = getResourceSchema(shadowConfig, resource);
  const sortFieldType = shadowSchema.sortableFields[sort.field]?.type;

  if (!sortFieldType) {
    throw new ConfigError(`Sort field type not found: ${sort.field}`, {
      field: sort.field,
      resource,
    });
  }

  // シャドーSKのプレフィックスを生成
  const skPrefix = `${sort.field}#`;

  // ExclusiveStartKeyの設定（nextTokenがある場合）
  let exclusiveStartKey: Record<string, string> | undefined;
  if (nextToken) {
    const decoded = decodeNextToken(nextToken);
    exclusiveStartKey = {
      PK: decoded.PK,
      SK: decoded.SK,
    };
  }

  // シャドーレコードをQueryで取得
  const queryResult = await executeDynamoDBOperation(
    () =>
      dbClient.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
          ExpressionAttributeValues: {
            ':pk': resource,
            ':skPrefix': skPrefix,
          },
          ScanIndexForward: sort.order === 'ASC',
          Limit: perPage,
          ExclusiveStartKey: exclusiveStartKey,
          ConsistentRead: true,
        })
      ),
    'Query'
  );

  const shadowItems = queryResult.Items || [];

  // シャドーレコードが0件の場合は空レスポンスを返す
  if (shadowItems.length === 0) {
    return {
      items: [],
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };
  }

  // シャドーSKからレコードIDを抽出
  const recordIds = shadowItems.map((item) => {
    const sk = item.SK as string;
    const parts = sk.split('#id#');
    return parts[parts.length - 1];
  });

  // 本体レコードをBatchGetItemで取得
  const batchGetResult = await executeDynamoDBOperation(
    () =>
      dbClient.send(
        new BatchGetCommand({
          RequestItems: {
            [tableName]: {
              Keys: recordIds.map((recordId) => ({
                PK: resource,
                SK: `id#${recordId}`,
              })),
              ConsistentRead: true,
            },
          },
        })
      ),
    'BatchGetItem'
  );

  const mainRecords = batchGetResult.Responses?.[tableName] || [];

  // IDでマッピングを作成
  const recordMap = new Map(
    mainRecords.map((item) => {
      const data = item.data as Record<string, unknown>;
      return [data.id as string, extractCleanRecord(item)];
    })
  );

  // シャドーの順序でレコードを並べる
  let items = recordIds
    .map((recordId) => recordMap.get(recordId))
    .filter((record): record is Record<string, unknown> => record !== undefined);

  // target/idフィルターを適用
  items = items.filter((record) => record[target] === id);

  // 追加のフィルター条件を適用
  if (filter && Object.keys(filter).length > 0) {
    items = items.filter((record) => {
      return Object.entries(filter).every(([key, value]) => {
        return record[key] === value;
      });
    });
  }

  // ページネーション情報を生成
  const hasNextPage = queryResult.LastEvaluatedKey !== undefined;
  const nextTokenValue =
    hasNextPage && queryResult.LastEvaluatedKey
      ? encodeNextToken(
          queryResult.LastEvaluatedKey.PK as string,
          queryResult.LastEvaluatedKey.SK as string
        )
      : undefined;

  logger.info('findManyReference succeeded', {
    requestId,
    resource,
    target,
    id,
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
