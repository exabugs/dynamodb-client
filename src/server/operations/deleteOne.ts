/**
 * deleteOne 操作
 * 単一レコードを削除する
 *
 * 要件: 4.4, 5.2, 5.3
 */
import { GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';

import { ItemNotFoundError, createLogger } from '../../index.js';
import { generateMainRecordSK } from '../shadow/index.js';
import type { DeleteOneParams, DeleteOneResult } from '../types.js';
import { executeDynamoDBOperation, getDBClient, getTableName } from '../utils/dynamodb.js';

const logger = createLogger({ service: 'records-lambda' });

/**
 * deleteOne 操作を実行する
 *
 * 処理フロー:
 * 1. GetItemで既存レコードを取得（存在確認）
 * 2. __shadowKeysからシャドーSKリストを取得
 * 3. TransactWriteItemsでメインレコード + 全シャドーレコードを削除
 *
 * @param resource - リソース名
 * @param params - deleteOneパラメータ
 * @param requestId - リクエストID
 * @returns 削除されたレコードのID
 * @throws {ItemNotFoundError} レコードが存在しない場合
 */
export async function handleDeleteOne(
  resource: string,
  params: DeleteOneParams,
  requestId: string
): Promise<DeleteOneResult> {
  const { id } = params;

  logger.debug('Executing deleteOne', {
    requestId,
    resource,
    id,
  });

  const dbClient = getDBClient();
  const tableName = getTableName();

  // メインレコードのSKを生成
  const mainSK = generateMainRecordSK(id);

  // 既存レコードを取得（存在確認とシャドーキー取得）
  const getResult = await executeDynamoDBOperation(
    () =>
      dbClient.send(
        new GetCommand({
          TableName: tableName,
          Key: {
            PK: resource,
            SK: mainSK,
          },
          ConsistentRead: true,
        })
      ),
    'GetItem'
  );

  if (!getResult.Item) {
    throw new ItemNotFoundError(`Record not found: ${id}`, { resource, id });
  }

  const existingData = getResult.Item.data as Record<string, unknown>;
  const shadowKeys = (existingData.__shadowKeys as string[]) || [];

  // TransactWriteItemsで一括削除
  const transactItems: Array<{
    Delete: { TableName: string; Key: Record<string, string> };
  }> = [];

  // メインレコードを削除
  transactItems.push({
    Delete: {
      TableName: tableName,
      Key: {
        PK: resource,
        SK: mainSK,
      },
    },
  });

  // 全シャドーレコードを削除
  for (const shadowSK of shadowKeys) {
    transactItems.push({
      Delete: {
        TableName: tableName,
        Key: {
          PK: resource,
          SK: shadowSK,
        },
      },
    });
  }

  // トランザクション実行
  await executeDynamoDBOperation(
    () =>
      dbClient.send(
        new TransactWriteCommand({
          TransactItems: transactItems,
        })
      ),
    'TransactWriteItems'
  );

  logger.info('deleteOne succeeded', {
    requestId,
    resource,
    id,
    shadowCount: shadowKeys.length,
  });

  return { id };
}
