/**
 * insertMany 操作
 * 複数レコードを一括作成する
 *
 * 要件: 4.1, 4.2, 5.2, 5.3, 7.4, 13.1, 13.2, 13.3, 13.7, 13.12
 */
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';

import { createLogger, ulid, ErrorCode } from '../../shared/index.js';
import { generateShadowRecords, getShadowConfig } from '../shadow/index.js';
import { generateMainRecordSK } from '../shadow/index.js';
import type { InsertManyParams, InsertManyResult, OperationError } from '../types.js';
import {
  calculateTimeoutRisk,
  logBulkOperationComplete,
  logLargeBatchWarning,
  logPartialFailure,
  logPreparationTimeoutRisk,
} from '../utils/bulkOperations.js';
import { calculateChunks, executeChunks } from '../utils/chunking.js';
import { executeDynamoDBOperation, getDBClient, getTableName } from '../utils/dynamodb.js';
import { addCreateTimestamps } from '../utils/timestamps.js';
import { addTTL } from '../utils/ttl.js';

const logger = createLogger({ service: 'records-lambda' });

/**
 * 準備済みレコードデータ（チャンク分割用）
 */
interface PreparedRecord {
  /** レコードID */
  id: string;
  /** 完全なレコードデータ（タイムスタンプ含む） */
  fullRecordData: Record<string, unknown>;
  /** シャドーSK配列 */
  shadowKeys: string[];
  /** メインレコードSK */
  mainSK: string;
}

/**
 * insertMany 操作を実行する
 *
 * 処理フロー:
 * 1. 各レコードにULIDを生成
 * 2. createdAt, updatedAtタイムスタンプを追加
 * 3. シャドー設定を読み込み、全シャドーSKを生成
 * 4. アイテム数を計算してチャンク分割（1 + シャドー数）
 * 5. 各チャンクをTransactWriteItemsで順次実行
 * 6. 部分失敗をハンドリング
 *
 * @param resource - リソース名
 * @param params - insertManyパラメータ
 * @param requestId - リクエストID
 * @returns 作成結果（成功レコード、失敗ID、エラー情報）
 */
export async function handleInsertMany(
  resource: string,
  params: InsertManyParams,
  requestId: string
): Promise<InsertManyResult> {
  const { data: recordsData } = params;
  const startTime = Date.now();

  logger.debug('Executing insertMany', {
    requestId,
    resource,
    count: recordsData.length,
  });

  // データが空の場合は空レスポンスを返す
  if (recordsData.length === 0) {
    return {
      count: 0,
      successIds: {},
      failedIds: {},
      errors: {},
    };
  }

  // 大量レコード処理時の警告ログ出力（要件: 13.12）
  logLargeBatchWarning('insertMany', recordsData.length, requestId, resource);

  const dbClient = getDBClient();
  const tableName = getTableName();

  // シャドー設定を取得（環境変数からキャッシュ付き）
  const shadowConfig = getShadowConfig();

  const preparedRecords: PreparedRecord[] = [];
  const preparationFailedIds: string[] = [];
  const preparationErrors: OperationError[] = [];

  // 各レコードを準備
  for (let i = 0; i < recordsData.length; i++) {
    const recordData = recordsData[i];
    try {
      // IDを決定（指定されていればそれを使用、なければULIDを生成）
      const id = (recordData.id as string | undefined) || ulid();

      // レコードデータを構築（タイムスタンプとTTLを動的に追加）
      let fullRecordData: Record<string, unknown> = addCreateTimestamps({
        ...recordData,
        id,
      });

      // TTLを追加（リソースに応じて）
      fullRecordData = addTTL(resource, fullRecordData);

      // シャドーレコードを生成（自動フィールド検出）
      const shadowRecords = generateShadowRecords(fullRecordData, resource, shadowConfig);
      const shadowKeys = shadowRecords.map((shadow) => shadow.SK);

      // メインレコードのSKを生成
      const mainSK = generateMainRecordSK(id);

      preparedRecords.push({
        id,
        fullRecordData,
        shadowKeys,
        mainSK,
      });
    } catch (error) {
      // 準備段階で失敗したレコードのIDを決定
      const failedId = (recordData.id as string | undefined) || `temp-id-${i}`;
      const errorMessage = error instanceof Error ? error.message : 'Unknown preparation error';
      const errorCode = getPreparationErrorCode(error);

      logger.error('Failed to prepare record for creation', {
        requestId,
        recordId: failedId,
        error: errorMessage,
        errorCode,
        recordData,
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

  // アイテム数計算関数（1 + シャドー数）
  const getItemCount = (record: PreparedRecord): number => {
    return 1 + record.shadowKeys.length;
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
  const executeChunk = async (chunk: PreparedRecord[]): Promise<PreparedRecord[]> => {
    const transactItems: Array<{
      Put: { TableName: string; Item: Record<string, unknown> };
    }> = [];

    // チャンク内の各レコードをTransactItemsに変換
    for (const record of chunk) {
      // メインレコードを追加
      transactItems.push({
        Put: {
          TableName: tableName,
          Item: {
            PK: resource,
            SK: record.mainSK,
            data: {
              ...record.fullRecordData,
              __shadowKeys: record.shadowKeys,
            },
          },
        },
      });

      // シャドーレコードを追加
      for (const shadowSK of record.shadowKeys) {
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
  for (let i = 0; i < preparedRecords.length; i++) {
    const record = preparedRecords[i];
    if (successIdSet.has(record.id)) {
      successIds[i] = record.id;
    }
  }

  // 準備失敗のインデックスを特定
  for (let i = 0; i < recordsData.length; i++) {
    const recordData = recordsData[i];
    const id = (recordData.id as string | undefined) || `temp-id-${i}`;
    if (preparationFailedIds.includes(id)) {
      failedIdsMap[i] = id;
      const error = preparationErrors.find((e) => e.id === id);
      if (error) {
        errorsMap[i] = error;
      }
    }
  }

  // チャンク実行失敗のインデックスを特定
  for (let i = 0; i < preparedRecords.length; i++) {
    const record = preparedRecords[i];
    if (chunkFailedIds.includes(record.id)) {
      failedIdsMap[i] = record.id;
      const error = chunkErrors.find((e) => e.id === record.id);
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
    'insertMany',
    requestId,
    resource,
    recordsData.length,
    count,
    allFailedIds.length,
    completionRiskInfo,
    {
      created: count,
      preparationFailed: preparationFailedIds.length,
      chunkExecutionFailed: chunkFailedIds.length,
    }
  );

  // 部分失敗の場合、詳細なエラーサマリーをログ出力
  if (allFailedIds.length > 0) {
    logPartialFailure(
      'insertMany',
      requestId,
      resource,
      recordsData.length,
      count,
      allFailedIds.length,
      Object.values(errorsMap).map((e) => e.code),
      {
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
  return ErrorCode.VALIDATION_ERROR;
}
