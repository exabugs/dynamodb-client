/**
 * バルク操作共通ユーティリティ
 *
 * createMany、updateMany、deleteManyなどのバルク操作で共通して使用される
 * 定数、型、ヘルパー関数を提供する。
 *
 * 要件: 13.12
 */
import { 
  createLogger,
  LAMBDA_TIMEOUT_MS,
  LARGE_BATCH_WARNING_THRESHOLD,
  TIMEOUT_RISK_THRESHOLD
} from '../../shared/index.js';

const logger = createLogger({ service: 'records-lambda' });

/**
 * バルク操作のタイムアウトリスク情報
 */
export interface TimeoutRiskInfo {
  /** 経過時間（ミリ秒） */
  elapsedMs: number;
  /** 残り時間（ミリ秒） */
  remainingMs: number;
  /** タイムアウトリスク（high/low） */
  risk: 'high' | 'low';
  /** タイムアウト利用率（0-100%） */
  utilizationPercent: number;
}

/**
 * 大量レコード処理時の警告ログを出力する
 *
 * @param operation - 操作名（createMany、updateMany、deleteManyなど）
 * @param recordCount - レコード数
 * @param requestId - リクエストID
 * @param resource - リソース名
 */
export function logLargeBatchWarning(
  operation: string,
  recordCount: number,
  requestId: string,
  resource: string
): void {
  if (recordCount > LARGE_BATCH_WARNING_THRESHOLD) {
    logger.warn(`Large batch ${operation} operation detected`, {
      requestId,
      resource,
      recordCount,
      warningThreshold: LARGE_BATCH_WARNING_THRESHOLD,
      estimatedTimeoutRisk: 'high',
      recommendation:
        'Consider splitting the batch into smaller requests to avoid Lambda timeout (15 min limit)',
    });
  }
}

/**
 * タイムアウトリスク情報を計算する
 *
 * @param startTime - 処理開始時刻（Date.now()の値）
 * @returns タイムアウトリスク情報
 */
export function calculateTimeoutRisk(startTime: number): TimeoutRiskInfo {
  const elapsedMs = Date.now() - startTime;
  const remainingMs = LAMBDA_TIMEOUT_MS - elapsedMs;
  const utilizationPercent = Math.round((elapsedMs / LAMBDA_TIMEOUT_MS) * 100);
  const risk = remainingMs < LAMBDA_TIMEOUT_MS * TIMEOUT_RISK_THRESHOLD ? 'high' : 'low';

  return {
    elapsedMs,
    remainingMs,
    risk,
    utilizationPercent,
  };
}

/**
 * 準備段階のタイムアウトリスクをログ出力する
 *
 * @param requestId - リクエストID
 * @param resource - リソース名
 * @param totalRecords - 総レコード数
 * @param chunkCount - チャンク数
 * @param riskInfo - タイムアウトリスク情報
 */
export function logPreparationTimeoutRisk(
  requestId: string,
  resource: string,
  totalRecords: number,
  chunkCount: number,
  riskInfo: TimeoutRiskInfo
): void {
  logger.info('Records prepared for chunk execution', {
    requestId,
    resource,
    totalRecords,
    chunkCount,
    preparationTimeMs: riskInfo.elapsedMs,
    remainingTimeMs: riskInfo.remainingMs,
    timeoutRisk: riskInfo.risk,
  });

  // タイムアウトリスクが高い場合の警告
  if (riskInfo.risk === 'high') {
    logger.warn('High timeout risk detected during preparation phase', {
      requestId,
      resource,
      preparationElapsedMs: riskInfo.elapsedMs,
      remainingTimeMs: riskInfo.remainingMs,
      lambdaTimeoutMs: LAMBDA_TIMEOUT_MS,
      recommendation: 'Consider reducing batch size or optimizing preparation logic',
    });
  }
}

/**
 * バルク操作完了時のログを出力する
 *
 * @param operation - 操作名（createMany、updateMany、deleteManyなど）
 * @param requestId - リクエストID
 * @param resource - リソース名
 * @param requested - リクエストされたレコード数
 * @param succeeded - 成功したレコード数
 * @param failed - 失敗したレコード数
 * @param riskInfo - タイムアウトリスク情報
 * @param additionalInfo - 追加情報（オプション）
 */
export function logBulkOperationComplete(
  operation: string,
  requestId: string,
  resource: string,
  requested: number,
  succeeded: number,
  failed: number,
  riskInfo: TimeoutRiskInfo,
  additionalInfo?: Record<string, unknown>
): void {
  const totalElapsedSeconds = Math.round(riskInfo.elapsedMs / 1000);

  logger.info(`${operation} completed`, {
    requestId,
    resource,
    requested,
    succeeded,
    totalFailed: failed,
    totalExecutionTimeMs: riskInfo.elapsedMs,
    totalExecutionTimeSeconds: totalElapsedSeconds,
    lambdaTimeoutMs: LAMBDA_TIMEOUT_MS,
    timeoutUtilization: `${riskInfo.utilizationPercent}%`,
    ...additionalInfo,
  });
}

/**
 * 部分失敗時の詳細ログを出力する
 *
 * @param operation - 操作名（createMany、updateMany、deleteManyなど）
 * @param requestId - リクエストID
 * @param resource - リソース名
 * @param requested - リクエストされたレコード数
 * @param succeeded - 成功したレコード数
 * @param failed - 失敗したレコード数
 * @param errorCodes - エラーコードの配列
 * @param additionalInfo - 追加情報（オプション）
 */
export function logPartialFailure(
  operation: string,
  requestId: string,
  resource: string,
  requested: number,
  succeeded: number,
  failed: number,
  errorCodes: string[],
  additionalInfo?: Record<string, unknown>
): void {
  const failureRate = Math.round((failed / requested) * 100);

  logger.warn(`Partial failure in ${operation} operation`, {
    requestId,
    resource,
    totalRequested: requested,
    successCount: succeeded,
    failedCount: failed,
    failureRate: `${failureRate}%`,
    errorCodes: [...new Set(errorCodes)],
    ...additionalInfo,
  });
}
