/**
 * updateMany 操作
 * 複数レコードを一括更新する（JSON Merge Patch形式）
 *
 * 要件: 4.2, 4.4, 5.2, 5.3, 7.4, 13.1, 13.2, 13.3, 13.8, 13.12
 */
import { BatchGetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';

import {
  createLogger,
  generateShadowRecords,
  getShadowConfig,
} from '../../index.js';
import { calculateShadowDiff, generateMainRecordSK } from '../shadow/index.js';
import type { OperationError, UpdateManyParams, UpdateManyResult } from '../types.js';
import {
  calculateTimeoutRisk,
  logBulkOperationComplete,
  logLargeBatchWarning,
  logPartialFailure,
  logPreparationTimeoutRisk,
} from '../utils/bulkOperations.js';
import { calculateChunks, executeChunks } from '../utils/chunking.js';
import {
  executeDynamoDBOperation,
  getDBClient,
  getTableName,
  removeShadowKeys,
} from '../utils/dynamodb.js';
import { addUpdateTimestamp } from '../utils/timestamps.js';

const logger = createLogger({ service: 'records-lambda' });

/**
 * 準備済み更新レコードデータ（チャンク分割用）
 */
interface PreparedUpdateRecord {
  /** レコードID */
  id: string;
  /** 更新後の完全なレコードデータ */
  updatedData: Record<string, unknown>;
  /** 旧シャドーSK配列 */
  oldShadowKeys: string[];
  /** 新シャドーSK配列 */
  newShadowKeys: string[];
  /** メインレコードSK */
  mainSK: string;
}

/**
 * JSON Merge Patch (RFC 7396) を適用する
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
      delete result[key];
    } else if (
      typeof value === 'object' &&
      !Array.isArray(value) &&
      value !== null &&
      typeof result[key] === 'object' &&
      !Array.isArray(result[key]) &&
      result[key] !== null
    ) {
      result[key] = applyJsonMergePatch(
        result[key] as Record<string, unknown>,
        value as Record<string, unknown>
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * updateMany 操作を実行する
 *
 * 処理フロー:
 * 1. BatchGetItemで既存レコードを取得
 * 2. 各レコードにJSON Merge Patchを適用
 * 3. updatedAtタイムスタンプを更新
 * 4. 新しいシャドーSKを生成し、差分を計算
 * 5. アイテム数を計算してチャンク分割（1 + 削除シャドー数 + 追加シャドー数）
 * 6. 各チャンクをTransactWriteItemsで順次実行
 * 7. 部分失敗をハンドリング
 *
 * @param resource - リソース名
 * @param params - updateManyパラメータ
 * @param requestId - リクエストID
 * @returns 更新結果（成功レコード、失敗ID、エラー情報）
 */
export async function handleUpdateMany(
  resource: string,
  params: UpdateManyParams,
  requestId: string
): Promise<UpdateManyResult> {
  const { ids, data: patchData } = params;
  const startTime = Date.now();

  logger.debug('Executing updateMany', {
    requestId,
    resource,
    count: ids.length,
  });

  // IDが空の場合は空レスポンスを返す
  if (ids.length === 0) {
    return {
      count: 0,
      successIds: {},
      failedIds: {},
      errors: {},
    };
  }

  // 大量レコード処理時の警告ログ出力（要件: 13.12）
  logLargeBatchWarning('updateMany', ids.length, requestId, resource);

  const dbClient = getDBClient();
  const tableName = getTableName();

  // BatchGetItemで既存レコードを取得
  const keys = ids.map((id) => ({
    PK: resource,
    SK: generateMainRecordSK(id),
  }));

  const batchGetResult = await executeDynamoDBOperation(
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

  const existingItems = batchGetResult.Responses?.[tableName] || [];

  // 存在するレコードのIDセットを作成
  const existingIds = new Set(
    existingItems.map((item) => {
      const data = item.data as Record<string, unknown>;
      return data.id as string;
    })
  );

  // 存在しないIDを特定
  const notFoundIds = ids.filter((id) => !existingIds.has(id));

  // シャドー設定を取得（環境変数からキャッシュ付き）
  const shadowConfig = getShadowConfig();

  const preparedRecords: PreparedUpdateRecord[] = [];
  const preparationFailedIds: string[] = [];
  const preparationErrors: OperationError[] = [];

  // 各レコードを準備
  for (const item of existingItems) {
    try {
      const existingData = item.data as Record<string, unknown>;
      const id = existingData.id as string;
      const oldShadowKeys = (existingData.__shadowKeys as string[]) || [];

      // JSON Merge Patchを適用
      const mergedData = applyJsonMergePatch(removeShadowKeys(existingData), patchData);

      // updatedAt を更新（タイムスタンプフィールド名は動的に取得）
      const updatedData: Record<string, unknown> = addUpdateTimestamp({
        ...mergedData,
        id,
      });

      // 新しいシャドーレコードを生成（自動フィールド検出）
      const newShadowRecords = generateShadowRecords(updatedData, resource, shadowConfig);
      const newShadowKeys = newShadowRecords.map((shadow) => shadow.SK);

      // メインレコードのSKを生成
      const mainSK = generateMainRecordSK(id);

      preparedRecords.push({
        id,
        updatedData,
        oldShadowKeys,
        newShadowKeys,
        mainSK,
      });
    } catch (error) {
      // 準備段階で失敗したレコードを記録
      const existingData = item.data as Record<string, unknown>;
      const failedId = (existingData.id as string) || 'unknown-id';
      const errorMessage = error instanceof Error ? error.message : 'Unknown preparation error';
      const errorCode = getPreparationErrorCode(error);

      logger.error('Failed to prepare record for update', {
        requestId,
        recordId: failedId,
        error: errorMessage,
        errorCode,
      });

      // 準備失敗をエラーリストに追加
      preparationFailedIds.push(failedId);
      preparationErrors.push({
        id: failedId,
        code: errorCode,
        message: errorMessage,
      });
    }
  }

  // アイテム数計算関数（1 + 削除シャドー数 + 追加シャドー数）
  const getItemCount = (record: PreparedUpdateRecord): number => {
    const shadowDiff = calculateShadowDiff(record.oldShadowKeys, record.newShadowKeys);
    return 1 + shadowDiff.toDelete.length + shadowDiff.toAdd.length;
  };

  // チャンク分割
  const { chunks } = calculateChunks(preparedRecords, getItemCount);

  // 準備段階の経過時間をチェック（要件: 13.12）
  const preparationRiskInfo = calculateTimeoutRisk(startTime);
  logPreparationTimeoutRisk(
    requestId,
    resource,
    preparedRecords.length,
    chunks.length,
    preparationRiskInfo
  );

  // チャンク実行関数
  const executeChunk = async (chunk: PreparedUpdateRecord[]): Promise<PreparedUpdateRecord[]> => {
    const transactItems: Array<{
      Put?: { TableName: string; Item: Record<string, unknown> };
      Delete?: { TableName: string; Key: Record<string, string> };
    }> = [];

    // チャンク内の各レコードをTransactItemsに変換
    for (const record of chunk) {
      // シャドー差分を計算
      const shadowDiff = calculateShadowDiff(record.oldShadowKeys, record.newShadowKeys);

      // メインレコードを更新
      transactItems.push({
        Put: {
          TableName: tableName,
          Item: {
            PK: resource,
            SK: record.mainSK,
            data: {
              ...record.updatedData,
              __shadowKeys: record.newShadowKeys,
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
      for (const shadowSK of shadowDiff.toAdd) {
        transactItems.push({
          Put: {
            TableName: tableName,
            Item: {
              PK: resource,
              SK: shadowSK,
              data: {},
            },
          },
        });
      }
    }

    // TransactWriteItemsを実行
    await executeDynamoDBOperation(
      () =>
        dbClient.send(
          new TransactWriteCommand({
            TransactItems: transactItems,
          })
        ),
      'TransactWriteItems'
    );

    // 成功したレコードを返す
    return chunk;
  };

  // チャンクを順次実行
  const {
    successRecords,
    failedIds: chunkFailedIds,
    errors: chunkErrors,
  } = await executeChunks(chunks, executeChunk, (record) => record.id);

  // 統一レスポンス形式を構築
  // successIds: インデックス付きオブジェクト（元の配列のインデックスとIDのマッピング）
  const successIds: Record<number, string> = {};
  const failedIdsMap: Record<number, string> = {};
  const errorsMap: Record<number, OperationError> = {};

  // 成功したレコードのインデックスを特定
  const successIdSet = new Set(successRecords.map((r) => r.id));
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (successIdSet.has(id)) {
      successIds[i] = id;
    }
  }

  // 存在しないIDのインデックスを特定
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (notFoundIds.includes(id)) {
      failedIdsMap[i] = id;
      errorsMap[i] = {
        id,
        code: 'ITEM_NOT_FOUND',
        message: `Record not found: ${id}`,
      };
    }
  }

  // 準備失敗のインデックスを特定
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (preparationFailedIds.includes(id)) {
      failedIdsMap[i] = id;
      const error = preparationErrors.find((e) => e.id === id);
      if (error) {
        errorsMap[i] = error;
      }
    }
  }

  // チャンク実行失敗のインデックスを特定
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (chunkFailedIds.includes(id)) {
      failedIdsMap[i] = id;
      const error = chunkErrors.find((e) => e.id === id);
      if (error) {
        errorsMap[i] = {
          id: error.id,
          code: error.code,
          message: error.message,
        };
      }
    }
  }

  const count = Object.keys(successIds).length;
  const allFailedIds = Object.values(failedIdsMap);

  // 総実行時間を計算（要件: 13.12）
  const completionRiskInfo = calculateTimeoutRisk(startTime);

  logBulkOperationComplete(
    'updateMany',
    requestId,
    resource,
    ids.length,
    count,
    allFailedIds.length,
    completionRiskInfo,
    {
      updated: count,
      notFound: notFoundIds.length,
      preparationFailed: preparationFailedIds.length,
      chunkExecutionFailed: chunkFailedIds.length,
    }
  );

  // 部分失敗の場合、詳細なエラーサマリーをログ出力
  if (allFailedIds.length > 0) {
    logPartialFailure(
      'updateMany',
      requestId,
      resource,
      ids.length,
      count,
      allFailedIds.length,
      Object.values(errorsMap).map((e) => e.code),
      {
        notFoundCount: notFoundIds.length,
        preparationFailures: preparationFailedIds.length,
        chunkExecutionFailures: chunkFailedIds.length,
      }
    );
  }

  // 統一レスポンス形式で返却
  return {
    count,
    successIds,
    failedIds: failedIdsMap,
    errors: errorsMap,
  };
}

/**
 * 準備段階のエラーからエラーコードを抽出する
 *
 * @param error - エラーオブジェクト
 * @returns エラーコード
 */
function getPreparationErrorCode(error: unknown): string {
  if (error && typeof error === 'object') {
    // カスタムエラー
    if ('code' in error && typeof error.code === 'string') {
      return error.code;
    }
    // AWS SDK エラー
    if ('name' in error && typeof error.name === 'string') {
      return error.name;
    }
  }
  return 'VALIDATION_ERROR';
}
