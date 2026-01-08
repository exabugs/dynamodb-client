/**
 * findOne 操作
 * 単一レコードをIDまたはフィルター条件で取得する
 *
 * 要件: 4.3, 5.4, 5.5
 */
import { GetCommand } from '@aws-sdk/lib-dynamodb';

import { ItemNotFoundError, createLogger } from '../../shared/index.js';
import { generateMainRecordSK } from '../shadow/index.js';
import type { FindOneParams, FindOneResult } from '../types.js';
import {
  executeDynamoDBOperation,
  extractCleanRecord,
  getDBClient,
  getTableName,
} from '../utils/dynamodb.js';
import { handleFind } from './find.js';

const logger = createLogger({ service: 'records-lambda' });

/**
 * findOne 操作を実行する
 *
 * idが指定された場合はGetItemでメインレコードを取得し、
 * filterが指定された場合はfind操作で検索して最初の結果を返す。
 * __shadowKeysを除外してレスポンスを返す。
 *
 * @param resource - リソース名
 * @param params - findOneパラメータ（idまたはfilter）
 * @param requestId - リクエストID
 * @returns レコードデータ
 * @throws {ItemNotFoundError} レコードが存在しない場合
 */
export async function handleFindOne(
  resource: string,
  params: FindOneParams,
  requestId: string
): Promise<FindOneResult> {
  // idが指定された場合は従来通りGetItemで取得
  if ('id' in params) {
    const { id } = params;

    logger.debug('Executing findOne by id', {
      requestId,
      resource,
      id,
    });

    const dbClient = getDBClient();
    const tableName = getTableName();

    // メインレコードのSKを生成
    const sk = generateMainRecordSK(id);

    // GetItemでレコードを取得（ConsistentRead=true）
    const result = await executeDynamoDBOperation(
      () =>
        dbClient.send(
          new GetCommand({
            TableName: tableName,
            Key: {
              PK: resource,
              SK: sk,
            },
            ConsistentRead: true,
          })
        ),
      'GetItem'
    );

    // レコードが存在しない場合
    if (!result.Item) {
      throw new ItemNotFoundError(`Record not found: ${id}`, { resource, id });
    }

    // data属性から__shadowKeysを除外してレスポンスを返す
    const record = extractCleanRecord(result.Item);

    logger.info('findOne by id succeeded', {
      requestId,
      resource,
      id,
    });

    return record;
  }

  // filterが指定された場合はfind操作で検索
  if ('filter' in params) {
    const { filter } = params;

    logger.debug('Executing findOne by filter', {
      requestId,
      resource,
      filter,
    });

    const findResult = await handleFind(
      resource,
      {
        filter,
        pagination: { perPage: 1 },
      },
      requestId
    );

    // レコードが存在しない場合
    if (!findResult.items || findResult.items.length === 0) {
      throw new ItemNotFoundError(`Record not found with filter`, { resource, filter });
    }

    logger.info('findOne by filter succeeded', {
      requestId,
      resource,
      filter,
    });

    return findResult.items[0];
  }

  // idもfilterも指定されていない場合（型的にはありえないが念のため）
  throw new Error('findOne requires either id or filter');
}
