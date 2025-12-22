/**
 * deleteMany 操作
 * 複数レコードを一括削除する
 *
 * 要件: 4.4, 5.2, 5.3, 7.4, 13.1, 13.2, 13.3, 13.9, 13.12
 */
import { BatchGetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';

import { createLogger } from '../../shared/index.js';
import { generateMainRecordSK } from '../shadow/index.js';
import type { DeleteManyParams, DeleteManyResult, OperationError } from '../types.js';
import {
  calculateTimeoutRisk,
  logBulkOperationComplete,
  logLargeBatchWarning,
  logPartialFailure,
  logPreparationTimeoutRisk,
} from '../utils/bulkOperations.js';
import { calculateChunks, executeChunks } from '../utils/chunking.js';
import { executeDynamoDBOperation, getDBClient, getTableName } from '../utils/dynamodb.js';

const logger = createLogger({ service: 'records-lambda' });

/**
 * 準備済み削除レコードデータ（チャンク分割用）
 */
interface PreparedDeleteRecord {
  /** レコードID */
  id: string;
  /** メインレコードSK */
  mainSK: string;
  /** シャドーSK配列 */
  shadowKeys: string[];
}

/**
 * deleteMany 操作を実行する
 *
 * 処理フロー:
 * 1. BatchGetItemで既存レコードを取得
 * 2. 各レコードの__shadowKeysからシャドーSKリストを取得
 * 3. アイテム数を計算してチャンク分割（1 + シャドー数）
 * 4. 各チャンクをTransactWriteItemsで順次実行
 * 5. 部分失敗をハンドリング
 *
 * @param resource - リソース名
 * @param params - deleteManyパラメータ
 * @param requestId - リクエストID
 * @returns 削除結果（成功ID、失敗ID、エラー情報）
 */
export async function handleDeleteMany(
  resource: string,
  params: DeleteManyParams,
  requestId: string
): Promise<DeleteManyResult> {
  const { ids } = params;
  const startTime = Date.now();

  logger.debug('Executing deleteMany', {
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
  logLargeBatchWarning('deleteMany', ids.length, requestId, resource);

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

  // 存在しないIDを特定
  const existingIds = new Set<string>();
  const preparedRecords: PreparedDeleteRecord[] = [];

  for (const item of existingItems) {
    const existingData = item.data as Record<string, unknown>;
    const id = existingData.id as string;
    const shadowKeys = (existingData.__shadowKeys as string[]) || [];

    existingIds.add(id);

    preparedRecords.push({
      id,
      mainSK: generateMainRecordSK(id),
      shadowKeys,
    });
  }

  const notFoundIds = ids.filter((id) => !existingIds.has(id));

  // 存在しないIDのエラー情報を作成
  const notFoundErrors: OperationError[] = notFoundIds.map((id) => ({
    id,
    code: 'ITEM_NOT_FOUND',
    message: `Record not found: ${id}`,
  }));

  // 存在するレコードがない場合は早期リターン
  if (preparedRecords.length === 0) {
    logger.info('deleteMany completed - no records found', {
      requestId,
      resource,
      requested: ids.length,
      notFound: notFoundIds.length,
    });

    // 統一レスポンス形式で返却
    const failedIdsMap: Record<number, string> = {};
    const errorsMap: Record<number, OperationError> = {};
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (notFoundIds.includes(id)) {
        failedIdsMap[i] = id;
        const error = notFoundErrors.find((e) => e.id === id);
        if (error) {
          errorsMap[i] = error;
        }
      }
    }

    return {
      count: 0,
      successIds: {},
      failedIds: failedIdsMap,
      errors: errorsMap,
    };
  }

  // アイテム数計算関数（1 + シャドー数）
  const getItemCount = (record: PreparedDeleteRecord): number => {
    return 1 + record.shadowKeys.length;
  };

  // チャンク分割（要件: 13.1, 13.2, 13.9）
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

  // チャンク実行関数（要件: 13.3）
  const executeChunk = async (chunk: PreparedDeleteRecord[]): Promise<PreparedDeleteRecord[]> => {
    const transactItems: Array<{
      Delete: { TableName: string; Key: Record<string, string> };
    }> = [];

    // チャンク内の各レコードをTransactItemsに変換
    for (const record of chunk) {
      // メインレコードを削除
      transactItems.push({
        Delete: {
          TableName: tableName,
          Key: {
            PK: resource,
            SK: record.mainSK,
          },
        },
      });

      // 全シャドーレコードを削除
      for (const shadowSK of record.shadowKeys) {
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

  // チャンクを順次実行（要件: 13.3, 13.4, 13.5, 13.6）
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
      const error = notFoundErrors.find((e) => e.id === id);
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
    'deleteMany',
    requestId,
    resource,
    ids.length,
    count,
    allFailedIds.length,
    completionRiskInfo,
    {
      deleted: count,
      notFound: notFoundIds.length,
      chunkExecutionFailed: chunkFailedIds.length,
    }
  );

  // 部分失敗の場合、詳細なエラーサマリーをログ出力（要件: 13.11）
  if (allFailedIds.length > 0) {
    logPartialFailure(
      'deleteMany',
      requestId,
      resource,
      ids.length,
      count,
      allFailedIds.length,
      Object.values(errorsMap).map((e) => e.code),
      {
        notFoundFailures: notFoundIds.length,
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
