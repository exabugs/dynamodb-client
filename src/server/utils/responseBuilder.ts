/**
 * レスポンスビルダー
 *
 * HTTPレスポンスを生成するユーティリティ
 */
import type { APIGatewayProxyResultV2 } from 'aws-lambda';

import { createLogger } from '../../shared/index.js';
import { HTTP_STATUS } from '../../shared/constants/http.js';
import type { ApiErrorResponse, ApiSuccessResponse } from '../types.js';

/**
 * ロガーインスタンス
 */
const logger = createLogger({
  service: 'response-builder',
  level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
});

/**
 * CORSヘッダー
 * Lambda Function URLのCORS設定を使用するため、ここでは空のオブジェクトにする
 */
const CORS_HEADERS = {};

/**
 * 成功レスポンスを生成する
 *
 * @param data - レスポンスデータ
 * @param requestId - リクエストID
 * @returns HTTPレスポンス
 */
export function createSuccessResponse(data: unknown, requestId: string): APIGatewayProxyResultV2 {
  const response: ApiSuccessResponse<unknown> = {
    success: true,
    data,
  };

  logger.info('Request succeeded', { requestId });

  return {
    statusCode: HTTP_STATUS.OK,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
    body: JSON.stringify(response),
  };
}

/**
 * エラーレスポンスを生成する
 *
 * @param code - エラーコード
 * @param message - エラーメッセージ
 * @param statusCode - HTTPステータスコード
 * @param requestId - リクエストID
 * @param details - 追加詳細情報
 * @returns HTTPレスポンス
 */
export function createErrorResponse(
  code: string,
  message: string,
  statusCode: number,
  requestId: string,
  details?: unknown
): APIGatewayProxyResultV2 {
  const response: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
      statusCode,
      details,
    },
  };

  logger.error('Request failed', {
    requestId,
    code,
    message,
    statusCode,
  });

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
    body: JSON.stringify(response),
  };
}

/**
 * CORSレスポンスを生成する
 *
 * @param statusCode - HTTPステータスコード
 * @returns HTTPレスポンス
 */
export function createCorsResponse(statusCode: number): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: '',
  };
}