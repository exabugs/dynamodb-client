/**
 * updateOne 操作
 * 単一レコードを更新する（JSON Merge Patch形式）
 *
 * 要件: 4.2, 4.4, 5.2, 5.3
 */
import { GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';

import {
  ItemNotFoundError,
  createLogger,
  generateShadowRecords,
  getResourceSchema,
  getShadowConfig,
} from '../../index.js';
import { calculateShadowDiff, generateMainRecordSK, isDiffEmpty } from '../shadow/index.js';
import type { UpdateOneParams, UpdateOneResult } from '../types.js';
import {
  executeDynamoDBOperation,
  getDBClient,
  getTableName,
  removeShadowKeys,
} from '../utils/dynamodb.js';
import { addUpdateTimestamp } from '../utils/timestamps.js';

const logger = createLogger({ service: 'records-lambda' });

/**
 * JSON Merge Patch (RFC 7396) を適用する
 *
 * ルール:
 * - null値はフィールド削除を意味する
 * - 配列は完全置換される
 * - オブジェクトは再帰的にマージされる
 *
 * @param target - 対象オブジェクト
 * @param patch - パッチオブジェクト
 * @returns マージされたオブジェクト
 */
function applyJsonMergePatch(
  target: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...target };

  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      // null値はフィールド削除
      delete result[key];
    } else if (
      typeof value === 'object' &&
      !Array.isArray(value) &&
      value !== null &&
      typeof result[key] === 'object' &&
      !Array.isArray(result[key]) &&
      result[key] !== null
    ) {
      // オブジェクトは再帰的にマージ
      result[key] = applyJsonMergePatch(
        result[key] as Record<string, unknown>,
        value as Record<string, unknown>
      );
    } else {
      // その他（配列、プリミティブ）は完全置換
      result[key] = value;
    }
  }

  return result;
}

/**
 * updateOne 操作を実行する
 *
 * 処理フロー:
 * 1. GetItemで既存レコードを取得
 * 2. JSON Merge Patchを適用
 * 3. updatedAtタイムスタンプを更新
 * 4. 新しいシャドーSKを生成
 * 5. 旧シャドーと新シャドーの差分を計算
 * 6. TransactWriteItemsでメインレコード更新 + 旧シャドー削除 + 新シャドー追加
 *
 * @param resource - リソース名
 * @param params - updateOneパラメータ
 * @param requestId - リクエストID
 * @returns 更新されたレコード
 * @throws {ItemNotFoundError} レコードが存在しない場合
 */
export async function handleUpdateOne(
  resource: string,
  params: UpdateOneParams,
  requestId: string
): Promise<UpdateOneResult> {
  const { id, data: patchData } = params;

  logger.debug('Executing updateOne', {
    requestId,
    resource,
    id,
  });

  const dbClient = getDBClient();
  const tableName = getTableName();

  // メインレコードのSKを生成
  const mainSK = generateMainRecordSK(id);

  // 既存レコードを取得
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
  const oldShadowKeys = (existingData.__shadowKeys as string[]) || [];

  // JSON Merge Patchを適用
  const mergedData = applyJsonMergePatch(removeShadowKeys(existingData), patchData);

  // updatedAt を更新（タイムスタンプフィールド名は動的に取得）
  const updatedData = addUpdateTimestamp({
    ...mergedData,
    id, // IDは変更不可
  });

  // シャドー設定を取得（環境変数からキャッシュ付き）
  const shadowConfig = getShadowConfig();
  const shadowSchema = getResourceSchema(shadowConfig, resource);

  // 新しいシャドーレコードを生成
  const newShadowRecords = generateShadowRecords(updatedData, shadowSchema);
  const newShadowKeys = newShadowRecords.map((shadow) => shadow.SK);

  // シャドー差分を計算
  const shadowDiff = calculateShadowDiff(oldShadowKeys, newShadowKeys);

  // TransactWriteItemsで一括更新
  const transactItems: Array<{
    Put?: { TableName: string; Item: Record<string, unknown> };
    Delete?: { TableName: string; Key: Record<string, string> };
  }> = [];

  // メインレコードを更新
  transactItems.push({
    Put: {
      TableName: tableName,
      Item: {
        PK: resource,
        SK: mainSK,
        data: {
          ...updatedData,
          __shadowKeys: newShadowKeys,
        },
      },
    },
  });

  // 旧シャドーを削除
  for (const shadowSK of shadowDiff.toDelete) {
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

  // 新シャドーを追加
  for (const shadowRecord of newShadowRecords) {
    if (shadowDiff.toAdd.includes(shadowRecord.SK)) {
      transactItems.push({
        Put: {
          TableName: tableName,
          Item: shadowRecord as unknown as Record<string, unknown>,
        },
      });
    }
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

  logger.info('updateOne succeeded', {
    requestId,
    resource,
    id,
    shadowDiffEmpty: isDiffEmpty(shadowDiff),
    shadowsDeleted: shadowDiff.toDelete.length,
    shadowsAdded: shadowDiff.toAdd.length,
  });

  // __shadowKeysを除外してレスポンスを返す
  return removeShadowKeys(updatedData);
}
