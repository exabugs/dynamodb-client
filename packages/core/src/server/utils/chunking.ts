/**
 * チャンク分割ユーティリティ
 *
 * DynamoDBのTransactWriteItemsは最大100アイテムまでしか処理できないため、
 * バルク操作（createMany、updateMany、deleteMany）で大量のレコードを処理する際に
 * チャンク分割が必要となる。
 *
 * 要件: 13.1, 13.2, 13.7, 13.8, 13.9
 */
import { createLogger } from '../../index.js';

const logger = createLogger({ service: 'records-lambda' });

/**
 * DynamoDB TransactWriteItemsの最大アイテム数制限
 *
 * DynamoDBのTransactWriteItemsは最大100アイテムまでしか処理できない。
 * この制限を超える場合は、複数のトランザクションに分割する必要がある。
 *
 * 参考: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html
 */
export const DYNAMODB_TRANSACT_WRITE_MAX_ITEMS = 100;

/**
 * チャンク分割結果
 */
export interface ChunkResult<T> {
  /** チャンク配列（各チャンクは100アイテム以下） */
  chunks: T[][];
  /** 各チャンクのアイテム数 */
  itemCounts: number[];
}

/**
 * バルク操作のチャンクサイズを動的に計算する
 *
 * 各レコードのアイテム数（メインレコード + シャドーレコード）を考慮して、
 * TransactWriteItemsの100アイテム制限内に収まるようにチャンクを分割する。
 *
 * @param records - 処理対象のレコード配列
 * @param getItemCount - 各レコードのアイテム数を計算する関数
 * @returns チャンク分割結果
 * @throws {Error} 単一レコードが100アイテムを超える場合
 *
 * @example
 * ```typescript
 * // createMany操作の例
 * const result = calculateChunks(records, (record) => {
 *   const shadowCount = calculateShadowCount(record);
 *   return 1 + shadowCount; // メイン + シャドー
 * });
 *
 * // updateMany操作の例
 * const result = calculateChunks(records, (record) => {
 *   const oldShadowCount = record.__shadowKeys?.length || 0;
 *   const newShadowCount = calculateNewShadowCount(record);
 *   return 1 + oldShadowCount + newShadowCount; // メイン + 削除 + 追加
 * });
 * ```
 */
export function calculateChunks<T>(
  records: T[],
  getItemCount: (record: T) => number
): ChunkResult<T> {
  const chunks: T[][] = [];
  const itemCounts: number[] = [];

  let currentChunk: T[] = [];
  let currentItemCount = 0;

  for (const record of records) {
    const itemCount = getItemCount(record);

    // 単一レコードがDynamoDB制限を超える場合はエラー
    if (itemCount > DYNAMODB_TRANSACT_WRITE_MAX_ITEMS) {
      const errorMsg = `Single record exceeds ${DYNAMODB_TRANSACT_WRITE_MAX_ITEMS} items limit: ${itemCount} items`;
      logger.error('Chunk validation failed', {
        itemCount,
        limit: DYNAMODB_TRANSACT_WRITE_MAX_ITEMS,
      });
      throw new Error(errorMsg);
    }

    // 現在のチャンクに追加するとDynamoDB制限を超える場合、新しいチャンクを開始
    if (currentItemCount + itemCount > DYNAMODB_TRANSACT_WRITE_MAX_ITEMS) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
        itemCounts.push(currentItemCount);
      }
      currentChunk = [record];
      currentItemCount = itemCount;
    } else {
      currentChunk.push(record);
      currentItemCount += itemCount;
    }
  }

  // 最後のチャンクを追加
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
    itemCounts.push(currentItemCount);
  }

  // 詳細なチャンク分割情報をログ出力
  logger.info('Chunk calculation completed', {
    totalRecords: records.length,
    chunkCount: chunks.length,
    itemCounts,
    minItemsPerChunk: itemCounts.length > 0 ? Math.min(...itemCounts) : 0,
    maxItemsPerChunk: itemCounts.length > 0 ? Math.max(...itemCounts) : 0,
    avgItemsPerChunk:
      itemCounts.length > 0
        ? Math.round(itemCounts.reduce((sum, count) => sum + count, 0) / itemCounts.length)
        : 0,
  });

  return { chunks, itemCounts };
}

/**
 * チャンク実行結果
 */
export interface ChunkExecutionResult<T> {
  /** 成功したレコード */
  successRecords: T[];
  /** 失敗したレコードのID */
  failedIds: string[];
  /** エラー情報 */
  errors: ChunkError[];
}

/**
 * チャンクエラー情報
 */
export interface ChunkError {
  /** レコードID */
  id: string;
  /** エラーコード */
  code: string;
  /** エラーメッセージ */
  message: string;
}

/**
 * チャンクを順次実行し、結果を集約する
 *
 * 各チャンクを独立したトランザクションとして実行し、1つのチャンクが失敗しても
 * 他のチャンクの処理を継続する（部分成功サポート）。
 *
 * @param chunks - 実行するチャンク配列
 * @param executeChunk - 各チャンクを実行する関数（成功したレコードを返す）
 * @param getRecordId - レコードからIDを取得する関数
 * @returns チャンク実行結果
 *
 * @example
 * ```typescript
 * const result = await executeChunks(
 *   chunks,
 *   async (chunk) => {
 *     // TransactWriteItemsでチャンクを実行
 *     await dynamoDBClient.send(new TransactWriteItemsCommand({
 *       TransactItems: buildTransactItems(chunk)
 *     }));
 *     return chunk; // 成功したレコードを返す
 *   },
 *   (record) => record.id
 * );
 * ```
 */
export async function executeChunks<T>(
  chunks: T[][],
  executeChunk: (chunk: T[]) => Promise<T[]>,
  getRecordId: (record: T) => string
): Promise<ChunkExecutionResult<T>> {
  const successRecords: T[] = [];
  const failedIds: string[] = [];
  const errors: ChunkError[] = [];

  const totalRecords = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const executionStartTime = Date.now();

  logger.info('Starting chunk execution', {
    totalChunks: chunks.length,
    totalRecords,
  });

  // 各チャンクを順次実行
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkStartTime = Date.now();

    try {
      logger.debug(`Executing chunk ${i + 1}/${chunks.length}`, {
        chunkIndex: i,
        recordCount: chunk.length,
      });

      // チャンクを実行
      const successfulRecords = await executeChunk(chunk);
      successRecords.push(...successfulRecords);

      const chunkDuration = Date.now() - chunkStartTime;
      logger.info(`Chunk ${i + 1}/${chunks.length} succeeded`, {
        chunkIndex: i,
        recordCount: chunk.length,
        durationMs: chunkDuration,
      });
    } catch (error) {
      // チャンクが失敗した場合、そのチャンク内のすべてのレコードを失敗として記録
      const chunkDuration = Date.now() - chunkStartTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = getErrorCode(error);

      logger.error(`Chunk ${i + 1}/${chunks.length} failed`, {
        chunkIndex: i,
        recordCount: chunk.length,
        durationMs: chunkDuration,
        error: errorMessage,
        errorCode,
      });

      // チャンク内のすべてのレコードを失敗として記録
      for (const record of chunk) {
        const recordId = getRecordId(record);
        failedIds.push(recordId);
        errors.push({
          id: recordId,
          code: errorCode,
          message: errorMessage,
        });
      }
    }
  }

  const totalExecutionTime = Date.now() - executionStartTime;

  // 実行結果のサマリーをログ出力
  logger.info('Chunk execution completed', {
    totalChunks: chunks.length,
    totalRecords,
    successCount: successRecords.length,
    failedCount: failedIds.length,
    totalExecutionTimeMs: totalExecutionTime,
    avgTimePerChunkMs: chunks.length > 0 ? Math.round(totalExecutionTime / chunks.length) : 0,
  });

  // 部分失敗の場合、詳細なエラー情報をログ出力
  if (failedIds.length > 0) {
    logger.warn('Partial failure detected in chunk execution', {
      totalRecords,
      successCount: successRecords.length,
      failedCount: failedIds.length,
      failureRate: `${Math.round((failedIds.length / totalRecords) * 100)}%`,
      failedIds: failedIds.slice(0, 10), // 最初の10件のみログ出力
      errorSummary: errors.slice(0, 5).map((e) => ({
        id: e.id,
        code: e.code,
        message: e.message.substring(0, 100), // メッセージを100文字に制限
      })),
    });
  }

  return {
    successRecords,
    failedIds,
    errors,
  };
}

/**
 * エラーからエラーコードを抽出する
 *
 * @param error - エラーオブジェクト
 * @returns エラーコード
 */
function getErrorCode(error: unknown): string {
  if (error && typeof error === 'object') {
    // AWS SDK エラー
    if ('name' in error && typeof error.name === 'string') {
      return error.name;
    }
    // カスタムエラー
    if ('code' in error && typeof error.code === 'string') {
      return error.code;
    }
  }
  return 'TRANSACTION_FAILED';
}
