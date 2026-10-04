/**
 * authHandler.ts の「実際に拒否されること」を検証する回帰テスト
 *
 * authHandler.test.ts は auth.js（verifyAuthHeader）を常に成功するモックに
 * 差し替えているため、「Cognito経路に振り分けられたこと」しか証明できず、
 * 偽装ヘッダーが実際に401相当のエラーで拒否されることは検証できていなかった
 * （第三者レビューで指摘）。
 *
 * このファイルはauth.jsをモックせず、実装（extractTokenFromHeader等）を
 * そのまま使って、脆弱性の再発防止を検証する。ネットワークアクセス
 * （JWKS取得等）が発生しない「ヘッダー形式が不正」なケースのみを扱う。
 */
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { beforeEach, describe, expect, it } from 'vitest';

import { handleAuthentication } from '../../../src/server/utils/authHandler.js';
import { AuthError } from '../../../src/shared/errors/index.js';

describe('authHandler（実装そのものでの拒否を検証）', () => {
  beforeEach(() => {
    process.env.COGNITO_USER_POOL_ID = 'us-east-1_ABC123';
    delete process.env.COGNITO_CLIENT_ID;
  });

  it('【脆弱性の回帰防止】requestContext.authorizer.iamが無く、x-amz-date/x-amz-content-sha256ヘッダーのみ（Authorizationヘッダー無し）の偽装リクエストはAuthErrorで拒否される', async () => {
    const event: APIGatewayProxyEventV2 = {
      headers: {
        'x-amz-date': '20261004T000000Z',
        'x-amz-content-sha256': 'x',
      },
      requestContext: {
        http: { sourceIp: '192.168.1.1' } as never,
      } as never,
    } as never;

    await expect(handleAuthentication(event, 'test-request-id')).rejects.toBeInstanceOf(
      AuthError
    );
    await expect(handleAuthentication(event, 'test-request-id')).rejects.toThrow(
      'Missing Authorization header'
    );
  });

  it('【脆弱性の回帰防止】requestContext.authorizer.iamが無く、偽のAWS4-HMAC-SHA256 Authorizationヘッダーを送ってもAuthErrorで拒否される（Bearer形式ではないため）', async () => {
    const event: APIGatewayProxyEventV2 = {
      headers: {
        authorization: 'AWS4-HMAC-SHA256 Credential=AKIAFAKE/20261004/us-east-1/lambda/aws4_request',
        'x-amz-date': '20261004T000000Z',
        'x-amz-content-sha256': 'x',
      },
      requestContext: {
        http: { sourceIp: '192.168.1.1' } as never,
      } as never,
    } as never;

    await expect(handleAuthentication(event, 'test-request-id')).rejects.toThrow(
      'Invalid Authorization header format'
    );
  });

  it('AuthErrorのstatusCodeが401である（HTTPレスポンスへの変換を保証する）', async () => {
    const event: APIGatewayProxyEventV2 = {
      headers: {},
      requestContext: {
        http: { sourceIp: '192.168.1.1' } as never,
      } as never,
    } as never;

    try {
      await handleAuthentication(event, 'test-request-id');
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AuthError);
      expect((error as AuthError).statusCode).toBe(401);
    }
  });
});
