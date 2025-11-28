/**
 * findOne 操作
 * 単一レコードをIDで取得する
 *
 * 要件: 4.3, 5.4, 5.5
 */
import { GetCommand } from '@aws-sdk/lib-dynamodb';

import type { FindOneParams, FindOneResult } from '../types.js';
import { ItemNotFoundError, createLogger } from '../../index.js';
import { generateMainRecordSK } from '../shadow/index.js';

import {
  executeDynamoDBOperation,
  extractCleanRecord,
  getDBClient,
  getTableName,
} from '../utils/dynamodb.js';

const logger = createLogger({ service: 'records-lambda' });

/**
 * findOne 操作を実行する
 *
 * GetItemでメインレコードを取得し、__shadowKeysを除外してレスポンスを返す。
 *
 * @param resource - リソース名
 * @param params - findOneパラメータ
 * @param requestId - リクエストID
 * @returns レコードデータ
 * @throws {ItemNotFoundError} レコードが存在しない場合
 */
export async function handleFindOne(
  resource: string,
  params: FindOneParams,
  requestId: string
): Promise<FindOneResult> {
  const { id } = params;

  logger.debug('Executing findOne', {
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

  logger.info('findOne succeeded', {
    requestId,
    resource,
    id,
  });

  return record;
}
