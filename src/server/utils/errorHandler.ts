/**
 * エラーハンドラー
 *
 * エラーをハンドリングしてHTTPレスポンスを生成する
 */
import type { APIGatewayProxyResultV2 } from 'aws-lambda';

import { createLogger, isAppError } from '../../shared/index.js';
import { createErrorResponse } from './responseBuilder.js';

/**
 * ロガーインスタンス
 */
const logger = createLogger({
  service: 'error-handler',
  level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
});

/**
 * エラーをハンドリングしてレスポンスを生成する
 *
 * @param error - エラーオブジェクト
 * @param requestId - リクエストID
 * @returns HTTPレスポンス
 */
export function handleError(error: unknown, requestId: string): APIGatewayProxyResultV2 {
  // AppError（アプリケーション定義エラー）の場合
  if (isAppError(error)) {
    return createErrorResponse(
      error.code,
      error.message,
      error.statusCode,
      requestId,
      error.details
    );
  }

  // 標準Errorの場合
  if (error instanceof Error) {
    // スタックトレースをログ出力
    logger.error('Error stack trace', {
      requestId,
      stack: error.stack,
      message: error.message,
    });

    // バリデーションエラーの判定
    if (isValidationError(error.message)) {
      return createErrorResponse('VALIDATION_ERROR', error.message, 400, requestId);
    }

    // 未実装エラーの判定
    if (error.message.includes('not yet implemented')) {
      return createErrorResponse('NOT_IMPLEMENTED', error.message, 501, requestId);
    }

    // 不明な操作エラーの判定
    if (error.message.includes('Unknown operation')) {
      return createErrorResponse('INVALID_OPERATION', error.message, 400, requestId);
    }

    // その他のエラー
    return createErrorResponse('INTERNAL_ERROR', error.message, 500, requestId);
  }

  // 予期しないエラー
  return createErrorResponse('UNKNOWN_ERROR', 'An unexpected error occurred', 500, requestId, {
    error: String(error),
  });
}

/**
 * バリデーションエラーかどうかを判定する
 *
 * @param message - エラーメッセージ
 * @returns バリデーションエラーの場合true
 */
function isValidationError(message: string): boolean {
  const validationErrorPatterns = [
    'Missing required field',
    'Invalid JSON',
    'Request body is required',
    'requires filter.id',
    'requires document',
    'requires documents',
  ];

  return validationErrorPatterns.some((pattern) => message.includes(pattern));
}