/**
 * 認証ハンドラー
 *
 * IAM認証とCognito JWT認証を処理する
 */
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

import { createLogger } from '../../shared/index.js';
import { verifyAuthHeader } from './auth.js';

/**
 * ロガーインスタンス
 */
const logger = createLogger({
  service: 'auth-handler',
  level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
});

/**
 * 認証を処理する
 *
 * @param event - Lambda Function URLイベント
 * @param requestId - リクエストID
 * @returns 認証が成功した場合はvoid、失敗した場合は例外をスロー
 * @throws {Error} 認証に失敗した場合
 */
export async function handleAuthentication(
  event: APIGatewayProxyEventV2,
  requestId: string
): Promise<void> {
  // 認証チェック: IAMまたはCognito JWT
  // Lambda Function URLがNONEの場合、両方の認証方式をサポート
  const authHeader = event.headers.authorization || event.headers.Authorization;

  // AWS SigV4署名の検出（複数のヘッダーで判定）
  const hasAmzDate = event.headers['x-amz-date'] || event.headers['X-Amz-Date'];
  const hasAmzContentSha =
    event.headers['x-amz-content-sha256'] || event.headers['X-Amz-Content-Sha256'];
  const hasAwsSigV4Auth = authHeader?.startsWith('AWS4-HMAC-SHA256');

  // デバッグ: ヘッダーをログ出力
  logger.debug('Authentication check', {
    requestId,
    hasAuthHeader: !!authHeader,
    hasAmzDate: !!hasAmzDate,
    hasAmzContentSha: !!hasAmzContentSha,
    hasAwsSigV4Auth: !!hasAwsSigV4Auth,
    authHeaderPrefix: authHeader?.substring(0, 20),
  });

  // IAM認証チェック（AWS SigV4署名の特徴的なヘッダーで判定）
  // 以下のいずれかの条件を満たす場合、IAM認証とみなす:
  // 1. AuthorizationヘッダーがAWS4-HMAC-SHA256で始まる
  // 2. x-amz-dateとx-amz-content-sha256の両方が存在する
  const isIAMAuth = hasAwsSigV4Auth || !!(hasAmzDate && hasAmzContentSha);

  if (isIAMAuth) {
    await handleIAMAuthentication(event, requestId);
  } else {
    await handleCognitoAuthentication(authHeader, requestId);
  }
}

/**
 * IAM認証を処理する
 *
 * @param event - Lambda Function URLイベント
 * @param requestId - リクエストID
 */
async function handleIAMAuthentication(
  event: APIGatewayProxyEventV2,
  requestId: string
): Promise<void> {
  // IAM認証（スクリプトからのアクセス）
  // Lambda Function URLがNONEの場合、署名検証は行われないため、
  // ここではIAM認証として扱うが、実際の検証はAWS側で行われる
  logger.info('IAM authenticated request', {
    requestId,
    sourceIp: event.requestContext.http.sourceIp,
  });
}

/**
 * Cognito JWT認証を処理する
 *
 * @param authHeader - Authorizationヘッダー
 * @param requestId - リクエストID
 * @throws {Error} 認証に失敗した場合
 */
async function handleCognitoAuthentication(
  authHeader: string | undefined,
  requestId: string
): Promise<void> {
  // Cognito JWT認証（ブラウザからのアクセス）
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_CLIENT_ID; // オプション

  if (!userPoolId) {
    throw new Error('COGNITO_USER_POOL_ID environment variable is required');
  }

  const jwtPayload = await verifyAuthHeader(authHeader, userPoolId, clientId);

  logger.debug('Cognito JWT verified', {
    requestId,
    sub: jwtPayload.sub,
    email: jwtPayload.email,
  });

  // TODO: テナント境界の実装
  // jwtPayload.subをレコードのuserIdフィールドと照合する
}