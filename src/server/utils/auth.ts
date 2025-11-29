/**
 * Cognito JWT 検証ユーティリティ
 * aws-jwt-verify を使用した署名検証を実装
 *
 * 要件: 9.1, 9.3
 */
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import type { CognitoJwtPayload } from 'aws-jwt-verify/jwt-model';

import { AuthError, createLogger } from '../../index.js';

const logger = createLogger({ service: 'records-lambda' });

/**
 * JWT ペイロード（Cognito ID Token）
 * aws-jwt-verify の CognitoJwtPayload を使用
 */
export type JwtPayload = CognitoJwtPayload;

/**
 * JWT Verifier インスタンス（Lambda コンテキスト間で再利用）
 *
 * aws-jwt-verify は内部で JWKS をキャッシュするため、
 * グローバル変数として保持することでパフォーマンスを向上させる
 */
let verifierInstance: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

/**
 * JWT Verifier インスタンスを取得する（シングルトンパターン）
 *
 * @param userPoolId - Cognito User Pool ID
 * @param clientId - Cognito App Client ID（オプション、指定時は aud を検証）
 * @returns JWT Verifier インスタンス
 */
function getVerifier(userPoolId: string, clientId?: string) {
  if (!verifierInstance) {
    logger.debug('Creating JWT verifier instance', { userPoolId, clientId });

    verifierInstance = CognitoJwtVerifier.create({
      userPoolId,
      tokenUse: 'id', // ID トークンを検証
      clientId: clientId || null, // undefined を null に変換（aws-jwt-verify の型要件）
    });
  }

  return verifierInstance;
}

/**
 * Cognito JWT トークンを検証する（署名検証あり）
 *
 * aws-jwt-verify を使用して以下を検証:
 * - 署名検証（JWKS を使用した RSA 署名検証）
 * - 有効期限（exp）
 * - 発行時刻（iat）
 * - 発行者（iss）
 * - オーディエンス（aud、clientId が指定されている場合）
 * - token_use（'id' トークンのみ許可）
 *
 * @param token - JWT トークン（Bearer プレフィックスなし）
 * @param userPoolId - Cognito User Pool ID
 * @param clientId - Cognito App Client ID（オプション）
 * @returns 検証済みの JWT ペイロード
 * @throws トークンが無効な場合
 */
export async function verifyJwt(
  token: string,
  userPoolId: string,
  clientId?: string
): Promise<JwtPayload> {
  logger.debug('Verifying JWT token with signature validation');

  try {
    const verifier = getVerifier(userPoolId, clientId);

    // aws-jwt-verify による完全な検証（署名検証を含む）
    const payload = await verifier.verify(token);

    logger.debug('JWT token verified successfully', {
      sub: payload.sub,
      email: payload.email,
      tokenUse: payload.token_use,
    });

    return payload;
  } catch (error) {
    logger.error('JWT verification failed', {
      error: error instanceof Error ? error.message : String(error),
    });

    // エラーメッセージを整形
    let message = 'JWT verification failed';
    if (error instanceof Error) {
      if (error.message.includes('expired')) {
        message = 'Token has expired';
      } else if (error.message.includes('invalid signature')) {
        message = 'Invalid token signature';
      } else if (error.message.includes('invalid issuer')) {
        message = 'Invalid token issuer';
      } else if (error.message.includes('invalid audience')) {
        message = 'Invalid token audience';
      } else {
        message = error.message;
      }
    }

    throw new AuthError(message, {
      originalError: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * HTTP Authorization ヘッダーから JWT トークンを抽出する
 *
 * @param authHeader - Authorization ヘッダーの値
 * @returns JWT トークン（Bearer プレフィックスなし）
 * @throws ヘッダーの形式が不正な場合
 */
export function extractTokenFromHeader(authHeader: string | undefined): string {
  if (!authHeader) {
    throw new AuthError('Missing Authorization header');
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new AuthError('Invalid Authorization header format: expected "Bearer <token>"');
  }

  return parts[1];
}

/**
 * HTTP リクエストから JWT トークンを検証する（ヘルパー関数）
 *
 * @param authHeader - Authorization ヘッダーの値
 * @param userPoolId - Cognito User Pool ID
 * @param clientId - Cognito App Client ID（オプション）
 * @returns 検証済みの JWT ペイロード
 * @throws トークンが無効な場合
 */
export async function verifyAuthHeader(
  authHeader: string | undefined,
  userPoolId: string,
  clientId?: string
): Promise<JwtPayload> {
  const token = extractTokenFromHeader(authHeader);
  return await verifyJwt(token, userPoolId, clientId);
}
