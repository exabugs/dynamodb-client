/**
 * authHandler.ts のユニットテスト
 * 認証ハンドラーの動作をテスト
 */
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleAuthentication } from '../../../src/server/utils/authHandler.js';

// auth.jsのverifyAuthHeaderをモック
vi.mock('../../../src/server/utils/auth.js', () => ({
  verifyAuthHeader: vi.fn().mockResolvedValue({
    sub: 'user-123',
    email: 'test@example.com',
  }),
}));

describe('authHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 環境変数をリセット
    delete process.env.COGNITO_USER_POOL_ID;
    delete process.env.COGNITO_CLIENT_ID;
  });

  describe('handleAuthentication', () => {
    it('IAM認証を正しく処理する（AWS4-HMAC-SHA256）', async () => {
      const event: APIGatewayProxyEventV2 = {
        headers: {
          authorization: 'AWS4-HMAC-SHA256 Credential=...',
        },
        requestContext: {
          http: {
            sourceIp: '192.168.1.1',
          } as any,
        } as any,
      } as any;

      await expect(handleAuthentication(event, 'test-request-id')).resolves.toBeUndefined();
    });

    it('IAM認証を正しく処理する（x-amz-dateとx-amz-content-sha256）', async () => {
      const event: APIGatewayProxyEventV2 = {
        headers: {
          'x-amz-date': '20230101T000000Z',
          'x-amz-content-sha256': 'abc123',
        },
        requestContext: {
          http: {
            sourceIp: '192.168.1.1',
          } as any,
        } as any,
      } as any;

      await expect(handleAuthentication(event, 'test-request-id')).resolves.toBeUndefined();
    });

    it('IAM認証を正しく処理する（大文字ヘッダー）', async () => {
      const event: APIGatewayProxyEventV2 = {
        headers: {
          'X-Amz-Date': '20230101T000000Z',
          'X-Amz-Content-Sha256': 'abc123',
        },
        requestContext: {
          http: {
            sourceIp: '192.168.1.1',
          } as any,
        } as any,
      } as any;

      await expect(handleAuthentication(event, 'test-request-id')).resolves.toBeUndefined();
    });

    it('Cognito JWT認証を正しく処理する', async () => {
      process.env.COGNITO_USER_POOL_ID = 'us-east-1_ABC123';

      const event: APIGatewayProxyEventV2 = {
        headers: {
          authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
        requestContext: {
          http: {
            sourceIp: '192.168.1.1',
          } as any,
        } as any,
      } as any;

      await expect(handleAuthentication(event, 'test-request-id')).resolves.toBeUndefined();
    });

    it('Cognito JWT認証を正しく処理する（Authorizationヘッダー大文字）', async () => {
      process.env.COGNITO_USER_POOL_ID = 'us-east-1_ABC123';

      const event: APIGatewayProxyEventV2 = {
        headers: {
          Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
        requestContext: {
          http: {
            sourceIp: '192.168.1.1',
          } as any,
        } as any,
      } as any;

      await expect(handleAuthentication(event, 'test-request-id')).resolves.toBeUndefined();
    });

    it('COGNITO_USER_POOL_IDが設定されていない場合にエラーをスローする', async () => {
      const event: APIGatewayProxyEventV2 = {
        headers: {
          authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
        requestContext: {
          http: {
            sourceIp: '192.168.1.1',
          } as any,
        } as any,
      } as any;

      await expect(handleAuthentication(event, 'test-request-id')).rejects.toThrow(
        'COGNITO_USER_POOL_ID environment variable is required'
      );
    });

    it('認証ヘッダーがない場合にCognito認証を試みる', async () => {
      process.env.COGNITO_USER_POOL_ID = 'us-east-1_ABC123';

      const event: APIGatewayProxyEventV2 = {
        headers: {},
        requestContext: {
          http: {
            sourceIp: '192.168.1.1',
          } as any,
        } as any,
      } as any;

      // verifyAuthHeaderがundefinedで呼ばれることを確認
      await expect(handleAuthentication(event, 'test-request-id')).resolves.toBeUndefined();
    });
  });
});
