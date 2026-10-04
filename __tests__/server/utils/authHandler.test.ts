/**
 * authHandler.ts のユニットテスト
 * 認証ハンドラーの動作をテスト
 */
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleAuthentication } from '../../../src/server/utils/authHandler.js';

// auth.jsのverifyAuthHeaderをモック
const verifyAuthHeaderMock = vi.fn().mockResolvedValue({
  sub: 'user-123',
  email: 'test@example.com',
});
vi.mock('../../../src/server/utils/auth.js', () => ({
  verifyAuthHeader: (...args: unknown[]) => verifyAuthHeaderMock(...args),
}));

describe('authHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 環境変数をリセット
    delete process.env.COGNITO_USER_POOL_ID;
    delete process.env.COGNITO_CLIENT_ID;
  });

  describe('handleAuthentication', () => {
    it('requestContext.authorizer.iamがある場合はIAM認証として処理する（AWS_IAM Function URL経由）', async () => {
      const event = {
        headers: {},
        requestContext: {
          http: { sourceIp: '192.168.1.1' } as any,
          authorizer: {
            iam: {
              accessKey: 'AKIA...',
              accountId: '123456789012',
              callerId: 'AIDA...',
              cognitoIdentity: null,
              principalOrgId: 'o-xxxx',
              userArn: 'arn:aws:iam::123456789012:role/some-role',
              userId: 'AROA...',
            },
          },
        } as any,
      } as any;

      await expect(handleAuthentication(event, 'test-request-id')).resolves.toBeUndefined();
      expect(verifyAuthHeaderMock).not.toHaveBeenCalled();
    });

    it('【脆弱性の回帰防止】requestContext.authorizer.iamが無ければ、AWS4-HMAC-SHA256ヘッダーを送ってもIAM認証扱いにならずCognito検証に回る', async () => {
      process.env.COGNITO_USER_POOL_ID = 'us-east-1_ABC123';

      const event: APIGatewayProxyEventV2 = {
        headers: {
          authorization: 'AWS4-HMAC-SHA256 Credential=fake',
        },
        requestContext: {
          http: { sourceIp: '192.168.1.1' } as any,
        } as any,
      } as any;

      await handleAuthentication(event, 'test-request-id');

      // Cognito検証に渡されたことを確認する（偽装されたヘッダーだけではIAM認証を騙れない）
      expect(verifyAuthHeaderMock).toHaveBeenCalledWith(
        'AWS4-HMAC-SHA256 Credential=fake',
        'us-east-1_ABC123',
        undefined
      );
    });

    it('【脆弱性の回帰防止】requestContext.authorizer.iamが無ければ、x-amz-date/x-amz-content-sha256ヘッダーを送ってもIAM認証扱いにならずCognito検証に回る', async () => {
      process.env.COGNITO_USER_POOL_ID = 'us-east-1_ABC123';

      const event: APIGatewayProxyEventV2 = {
        headers: {
          'x-amz-date': '20230101T000000Z',
          'x-amz-content-sha256': 'abc123',
        },
        requestContext: {
          http: { sourceIp: '192.168.1.1' } as any,
        } as any,
      } as any;

      await handleAuthentication(event, 'test-request-id');

      expect(verifyAuthHeaderMock).toHaveBeenCalledWith(undefined, 'us-east-1_ABC123', undefined);
    });

    it('Cognito JWT認証を正しく処理する', async () => {
      process.env.COGNITO_USER_POOL_ID = 'us-east-1_ABC123';

      const event: APIGatewayProxyEventV2 = {
        headers: {
          authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
        requestContext: {
          http: { sourceIp: '192.168.1.1' } as any,
        } as any,
      } as any;

      await expect(handleAuthentication(event, 'test-request-id')).resolves.toBeUndefined();
      expect(verifyAuthHeaderMock).toHaveBeenCalledWith(
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        'us-east-1_ABC123',
        undefined
      );
    });

    it('COGNITO_CLIENT_IDが設定されている場合、aud検証のためverifyAuthHeaderに渡される', async () => {
      process.env.COGNITO_USER_POOL_ID = 'us-east-1_ABC123';
      process.env.COGNITO_CLIENT_ID = 'client-abc';

      const event: APIGatewayProxyEventV2 = {
        headers: {
          authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
        requestContext: {
          http: { sourceIp: '192.168.1.1' } as any,
        } as any,
      } as any;

      await handleAuthentication(event, 'test-request-id');

      expect(verifyAuthHeaderMock).toHaveBeenCalledWith(
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        'us-east-1_ABC123',
        'client-abc'
      );
    });

    it('Cognito JWT認証を正しく処理する（Authorizationヘッダー大文字）', async () => {
      process.env.COGNITO_USER_POOL_ID = 'us-east-1_ABC123';

      const event: APIGatewayProxyEventV2 = {
        headers: {
          Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
        requestContext: {
          http: { sourceIp: '192.168.1.1' } as any,
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
          http: { sourceIp: '192.168.1.1' } as any,
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
          http: { sourceIp: '192.168.1.1' } as any,
        } as any,
      } as any;

      await expect(handleAuthentication(event, 'test-request-id')).resolves.toBeUndefined();
      expect(verifyAuthHeaderMock).toHaveBeenCalledWith(undefined, 'us-east-1_ABC123', undefined);
    });
  });
});
