/**
 * Records Lambda - エントリーポイント
 *
 * HTTP API（Lambda Function URL）経由でCRUD操作を提供
 * MongoDB風の10操作をサポート
 */
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

import { createLogger } from '../shared/index.js';
import { HTTP_STATUS } from '../shared/constants/http.js';
import { executeOperation } from './operations/operationDispatcher.js';
import { handleAuthentication } from './utils/authHandler.js';
import { handleError } from './utils/errorHandler.js';
import { parseRequestBody } from './utils/requestParser.js';
import { createCorsResponse, createSuccessResponse } from './utils/responseBuilder.js';

/**
 * ロガーインスタンス
 */
const logger = createLogger({
  service: 'records-lambda',
  level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
});

// 起動時にログ出力（コールドスタート時のみ実行される）
logger.info('Records Lambda started with automatic shadow field detection');

/**
 * Lambda ハンドラー（HTTP対応）
 *
 * HTTPリクエストを受け取り、操作に応じた処理を実行してレスポンスを返す。
 * react-admin完全準拠の10操作をサポート。
 *
 * @param event - Lambda Function URLイベント
 * @returns HTTPレスポンス
 */
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const requestId = event.requestContext.requestId;

  logger.info('Received request', {
    requestId,
    method: event.requestContext.http.method,
    path: event.requestContext.http.path,
  });

  try {
    // CORSプリフライトリクエスト処理
    if (event.requestContext.http.method === 'OPTIONS') {
      return createCorsResponse(HTTP_STATUS.OK);
    }

    // POSTメソッドのみ許可
    if (event.requestContext.http.method !== 'POST') {
      throw new Error('Only POST method is allowed');
    }

    // 認証処理
    await handleAuthentication(event, requestId);

    // リクエストボディのパース（MongoDB風API形式をサポート）
    const request = parseRequestBody(event.body);

    logger.info('Parsed request', {
      requestId,
      operation: request.op,
      resource: request.resource,
    });

    // 操作の実行
    const result = await executeOperation(request, requestId);

    // 成功レスポンスの生成
    return createSuccessResponse(result, requestId);
  } catch (error) {
    // エラーハンドリング
    return handleError(error, requestId);
  }
}


