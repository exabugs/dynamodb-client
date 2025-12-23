/**
 * エラーハンドラー
 *
 * エラーをハンドリングしてHTTPレスポンスを生成する
 */
import type { APIGatewayProxyResultV2 } from 'aws-lambda';

import { createLogger, isAppError, ErrorCode } from '../../shared/index.js';
import { HTTP_STATUS } from '../../shared/constants/http.js';
import { VALIDATION_ERROR_PATTERNS } from '../../shared/constants/validation.js';
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
      return createErrorResponse(ErrorCode.VALIDATION_ERROR, error.message, HTTP_STATUS.BAD_REQUEST, requestId);
    }

    // 未実装エラーの判定
    if (error.message.includes('not yet implemented')) {
      return createErrorResponse(ErrorCode.NOT_IMPLEMENTED, error.message, HTTP_STATUS.NOT_IMPLEMENTED, requestId);
    }

    // 不明な操作エラーの判定
    if (error.message.includes('Unknown operation')) {
      return createErrorResponse(ErrorCode.INVALID_OPERATION, error.message, HTTP_STATUS.BAD_REQUEST, requestId);
    }

    // その他のエラー
    return createErrorResponse(ErrorCode.INTERNAL_ERROR, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR, requestId);
  }

  // 予期しないエラー
  return createErrorResponse(ErrorCode.UNKNOWN_ERROR, 'An unexpected error occurred', HTTP_STATUS.INTERNAL_SERVER_ERROR, requestId, {
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
  return VALIDATION_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}