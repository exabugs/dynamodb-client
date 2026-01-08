/**
 * findMany 操作
 * 複数レコードをIDリストまたはフィルター条件で取得する
 *
 * 要件: 4.3, 5.4, 5.5
 */
import { BatchGetCommand } from '@aws-sdk/lib-dynamodb';

import { createLogger } from '../../shared/index.js';
import { generateMainRecordSK } from '../shadow/index.js';
import type { FindManyParams, FindManyResult } from '../types.js';
import {
  executeDynamoDBOperation,
  extractCleanRecord,
  getDBClient,
  getTableName,
} from '../utils/dynamodb.js';
import { handleFind } from './find.js';

const logger = createLogger({ service: 'records-lambda' });

/**
 * findMany 操作を実行する
 *
 * idsが指定された場合はBatchGetItemで複数のメインレコードを取得し、
 * filterが指定された場合はfind操作で検索する。
 * __shadowKeysを除外してレスポンスを返す。
 *
 * @param resource - リソース名
 * @param params - findManyパラメータ（idsまたはfilter）
 * @param requestId - リクエストID
 * @returns レコードデータの配列
 */
export async function handleFindMany(
  resource: string,
  params: FindManyParams,
  requestId: string
): Promise<FindManyResult> {
  // idsが指定された場合は従来通りBatchGetItemで取得
  if ('ids' in params) {
    const { ids } = params;

    logger.debug('Executing findMany by ids', {
      requestId,
      resource,
      count: ids.length,
    });

    // IDが空の場合は空配列を返す
    if (ids.length === 0) {
      return [];
    }

    const dbClient = getDBClient();
    const tableName = getTableName();

    // BatchGetItemのキーを生成
    const keys = ids.map((id) => ({
      PK: resource,
      SK: generateMainRecordSK(id),
    }));

    // BatchGetItemでレコードを取得（ConsistentRead=true）
    const result = await executeDynamoDBOperation(
      () =>
        dbClient.send(
          new BatchGetCommand({
            RequestItems: {
              [tableName]: {
                Keys: keys,
                ConsistentRead: true,
              },
            },
          })
        ),
      'BatchGetItem'
    );

    // レスポンスからレコードを抽出
    const items = result.Responses?.[tableName] || [];

    // data属性から__shadowKeysを除外
    const records = items.map((item) => extractCleanRecord(item));

    logger.info('findMany by ids succeeded', {
      requestId,
      resource,
      requested: ids.length,
      found: records.length,
    });

    return records;
  }

  // filterが指定された場合はfind操作で検索
  if ('filter' in params) {
    const { filter } = params;

    logger.debug('Executing findMany by filter', {
      requestId,
      resource,
      filter,
    });

    const findResult = await handleFind(
      resource,
      {
        filter,
      },
      requestId
    );

    logger.info('findMany by filter succeeded', {
      requestId,
      resource,
      filter,
      found: findResult.items.length,
    });

    return findResult.items;
  }

  // idsもfilterも指定されていない場合（型的にはありえないが念のため）
  throw new Error('findMany requires either ids or filter');
}
