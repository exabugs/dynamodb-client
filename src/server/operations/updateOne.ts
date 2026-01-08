/**
 * updateOne 操作
 * 単一レコードを更新する（JSON Merge Patch形式）
 *
 * 要件: 4.2, 4.4, 5.2, 5.3
 */
import { GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';

import { ItemNotFoundError, createLogger } from '../../shared/index.js';
import { generateShadowRecords, getShadowConfig } from '../shadow/index.js';
import { calculateShadowDiff, generateMainRecordSK, isDiffEmpty } from '../shadow/index.js';
import type { UpdateOneParams, UpdateOneResult } from '../types.js';
import {
  executeDynamoDBOperation,
  getDBClient,
  getTableName,
  removeShadowKeys,
} from '../utils/dynamodb.js';
import { addCreateTimestamps, addUpdateTimestamp } from '../utils/timestamps.js';

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
 * 1. filterまたはidから対象レコードを特定
 * 2. レコードが存在しない場合:
 *    - upsert=falseの場合はエラー
 *    - upsert=trueの場合は新規作成
 * 3. レコードが存在する場合は更新
 *
 * @param resource - リソース名
 * @param params - updateOneパラメータ
 * @param requestId - リクエストID
 * @returns 更新されたレコード
 * @throws {ItemNotFoundError} レコードが存在しない場合（upsert=falseの場合）
 */
export async function handleUpdateOne(
  resource: string,
  params: UpdateOneParams,
  requestId: string
): Promise<UpdateOneResult> {
  const { data: patchData, options } = params;
  const upsert = options?.upsert ?? false;

  // idまたはfilterから対象レコードを特定
  let targetId: string;
  let existingItem: Record<string, unknown> | undefined;

  if ('id' in params) {
    // idが指定されている場合
    targetId = params.id;

    logger.debug('Executing updateOne with id', {
      requestId,
      resource,
      id: targetId,
      upsert,
    });

    const dbClient = getDBClient();
    const tableName = getTableName();
    const mainSK = generateMainRecordSK(targetId);

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

    existingItem = getResult.Item;
  } else {
    // filterが指定されている場合
    logger.debug('Executing updateOne with filter', {
      requestId,
      resource,
      filter: params.filter,
      upsert,
    });

    // filterで検索（find操作を使用）
    const { handleFind } = await import('./find.js');
    const findResult = await handleFind(
      resource,
      { filter: params.filter, pagination: { perPage: 1 } },
      requestId
    );

    if (findResult.items.length > 0) {
      const foundRecord = findResult.items[0];
      targetId = foundRecord.id as string;

      // 既存レコードを取得
      const dbClient = getDBClient();
      const tableName = getTableName();
      const mainSK = generateMainRecordSK(targetId);

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

      existingItem = getResult.Item;
    } else {
      // レコードが見つからない場合
      if (!upsert) {
        throw new ItemNotFoundError(`Record not found with filter`, {
          resource,
          filter: params.filter,
        });
      }

      // upsert=trueの場合、新しいIDを生成
      const { ulid } = await import('../../shared/index.js');
      targetId = ulid();
    }
  }

  // レコードが存在しない場合の処理
  if (!existingItem) {
    if (!upsert) {
      // upsert=falseの場合はエラー
      throw new ItemNotFoundError(`Record not found: ${targetId}`, { resource, id: targetId });
    }

    // upsert=trueの場合は新規作成
    return await handleUpsertCreate(resource, targetId, patchData, requestId);
  }

  // レコードが存在する場合は更新
  return await handleUpsertUpdate(resource, targetId, existingItem, patchData, requestId);
}

/**
 * upsertで新規作成
 *
 * 処理フロー:
 * 1. $set と $setOnInsert をマージ（$set が優先）
 * 2. createdAt と updatedAt を自動設定
 * 3. シャドーレコードを生成
 * 4. TransactWriteItemsでメインレコード + シャドーレコードを一括作成
 *
 * @param resource - リソース名
 * @param id - レコードID
 * @param data - レコードデータ（UpdateOperators形式）
 * @param requestId - リクエストID
 * @returns 作成されたレコード（__upsertedIdフラグ付き）
 */
async function handleUpsertCreate(
  resource: string,
  id: string,
  data: Record<string, unknown>,
  requestId: string
): Promise<UpdateOneResult> {
  // UpdateOperators形式の場合、$set と $setOnInsert をマージ
  const $set = (data.$set as Record<string, unknown>) || {};
  const $setOnInsert = (data.$setOnInsert as Record<string, unknown>) || {};

  // $set が $setOnInsert より優先される
  const mergedData = {
    ...$setOnInsert,
    ...$set,
  };

  // createdAt と updatedAt を自動設定
  const recordData = addCreateTimestamps({ ...mergedData, id });

  // シャドー設定を取得
  const shadowConfig = getShadowConfig();

  // シャドウレコードを生成
  const shadowRecords = generateShadowRecords(recordData, resource, shadowConfig);
  const shadowKeys = shadowRecords.map((shadow) => shadow.SK);

  // TransactWriteItemsで一括作成
  const transactItems: Array<{
    Put?: { TableName: string; Item: Record<string, unknown> };
  }> = [];

  // メインレコードを作成
  transactItems.push({
    Put: {
      TableName: getTableName(),
      Item: {
        PK: resource,
        SK: generateMainRecordSK(id),
        data: {
          ...recordData,
          __shadowKeys: shadowKeys,
        },
      },
    },
  });

  // シャドウレコードを作成
  for (const shadowRecord of shadowRecords) {
    transactItems.push({
      Put: {
        TableName: getTableName(),
        Item: shadowRecord as unknown as Record<string, unknown>,
      },
    });
  }

  // トランザクション実行
  await executeDynamoDBOperation(
    () =>
      getDBClient().send(
        new TransactWriteCommand({
          TransactItems: transactItems,
        })
      ),
    'TransactWriteItems'
  );

  logger.info('updateOne upsert created', {
    requestId,
    resource,
    id,
    shadowsCreated: shadowKeys.length,
  });

  // upsertedIdフラグを付けて返す（クライアント側で変換）
  return {
    ...removeShadowKeys(recordData),
    __upsertedId: id,
  };
}

/**
 * upsertで更新
 *
 * 処理フロー:
 * 1. UpdateOperators形式の場合、$set のみを抽出（$setOnInsert は無視）
 * 2. JSON Merge Patchを適用
 * 3. updatedAt を更新
 * 4. 新しいシャドーSKを生成
 * 5. 旧シャドーと新シャドーの差分を計算
 * 6. TransactWriteItemsでメインレコード更新 + 旧シャドー削除 + 新シャドー追加
 *
 * @param resource - リソース名
 * @param id - レコードID
 * @param existingItem - 既存のDynamoDBアイテム
 * @param patchData - パッチデータ（UpdateOperators形式または通常のパッチ）
 * @param requestId - リクエストID
 * @returns 更新されたレコード
 */
async function handleUpsertUpdate(
  resource: string,
  id: string,
  existingItem: Record<string, unknown>,
  patchData: Record<string, unknown>,
  requestId: string
): Promise<UpdateOneResult> {
  const existingData = existingItem.data as Record<string, unknown>;
  const oldShadowKeys = (existingData.__shadowKeys as string[]) || [];

  // UpdateOperators形式の場合、$set のみを抽出（$setOnInsert は無視）
  const actualPatchData = patchData.$set ? (patchData.$set as Record<string, unknown>) : patchData;

  // JSON Merge Patchを適用
  const mergedData = applyJsonMergePatch(removeShadowKeys(existingData), actualPatchData);

  // updatedAt を更新
  const updatedData = addUpdateTimestamp({
    ...mergedData,
    id, // IDは変更不可
  });

  // シャドー設定を取得
  const shadowConfig = getShadowConfig();

  // 新しいシャドーレコードを生成
  const newShadowRecords = generateShadowRecords(updatedData, resource, shadowConfig);
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
      TableName: getTableName(),
      Item: {
        PK: resource,
        SK: generateMainRecordSK(id),
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
        TableName: getTableName(),
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
          TableName: getTableName(),
          Item: shadowRecord as unknown as Record<string, unknown>,
        },
      });
    }
  }

  // トランザクション実行
  await executeDynamoDBOperation(
    () =>
      getDBClient().send(
        new TransactWriteCommand({
          TransactItems: transactItems,
        })
      ),
    'TransactWriteItems'
  );

  logger.info('updateOne upsert updated', {
    requestId,
    resource,
    id,
    shadowDiffEmpty: isDiffEmpty(shadowDiff),
    shadowsDeleted: shadowDiff.toDelete.length,
    shadowsAdded: shadowDiff.toAdd.length,
  });

  return removeShadowKeys(updatedData);
}
