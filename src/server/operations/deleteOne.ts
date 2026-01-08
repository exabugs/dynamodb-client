/**
 * deleteOne 操作
 * 単一レコードを削除する
 *
 * 要件: 4.4, 5.2, 5.3
 */
import { GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';

import { ItemNotFoundError, createLogger } from '../../shared/index.js';
import { generateMainRecordSK } from '../shadow/index.js';
import type { DeleteOneParams, DeleteOneResult } from '../types.js';
import { executeDynamoDBOperation, getDBClient, getTableName } from '../utils/dynamodb.js';

const logger = createLogger({ service: 'records-lambda' });

/**
 * deleteOne 操作を実行する
 *
 * 処理フロー:
 * 1. filterまたはidから対象レコードを特定
 * 2. GetItemで既存レコードを取得（存在確認）
 * 3. __shadowKeysからシャドーSKリストを取得
 * 4. TransactWriteItemsでメインレコード + 全シャドーレコードを削除
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
  // idまたはfilterから対象レコードを特定
  let targetId: string;

  if ('id' in params) {
    // idが指定されている場合
    targetId = params.id;

    logger.debug('Executing deleteOne with id', {
      requestId,
      resource,
      id: targetId,
    });
  } else {
    // filterが指定されている場合
    logger.debug('Executing deleteOne with filter', {
      requestId,
      resource,
      filter: params.filter,
    });

    // filterで検索（find操作を使用）
    const { handleFind } = await import('./find.js');
    const findResult = await handleFind(
      resource,
      { filter: params.filter, pagination: { perPage: 1 } },
      requestId
    );

    if (findResult.items.length === 0) {
      throw new ItemNotFoundError(`Record not found with filter`, {
        resource,
        filter: params.filter,
      });
    }

    const foundRecord = findResult.items[0];
    targetId = foundRecord.id as string;
  }

  const dbClient = getDBClient();
  const tableName = getTableName();

  // メインレコードのSKを生成
  const mainSK = generateMainRecordSK(targetId);

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
    throw new ItemNotFoundError(`Record not found: ${targetId}`, { resource, id: targetId });
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
    id: targetId,
    shadowCount: shadowKeys.length,
  });

  return { id: targetId };
}
