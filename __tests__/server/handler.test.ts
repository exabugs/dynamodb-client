/**
 * handler.ts のテスト
 *
 * Lambda ハンドラーのエントリーポイントをテスト
 */
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handler } from '../../src/server/handler.js';
import * as operationDispatcher from '../../src/server/operations/operationDispatcher.js';
import * as authHandler from '../../src/server/utils/authHandler.js';

// モック設定
vi.mock('../../src/server/utils/authHandler.js');
vi.mock('../../src/server/operations/operationDispatcher.js');

describe('handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('OPTIONSリクエストでCORSレスポンスを返す', async () => {
    const event = {
      requestContext: {
        requestId: 'test-request-id',
        http: {
          method: 'OPTIONS',
          path: '/test',
        },
      },
    } as APIGatewayProxyEventV2;

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(result.body).toBe('');
  });

  it('GET /versionでバージョン情報を返す', async () => {
    const event = {
      requestContext: {
        requestId: 'test-request-id',
        http: {
          method: 'GET',
          path: '/version',
        },
      },
    } as APIGatewayProxyEventV2;

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body || '{}');
    expect(body.data).toHaveProperty('version');
    expect(body.data).toHaveProperty('timestamp');
  });

  it('POSTリクエストで操作を実行する', async () => {
    const mockAuthHandler = vi.mocked(authHandler.handleAuthentication);
    const mockExecuteOperation = vi.mocked(operationDispatcher.executeOperation);

    mockAuthHandler.mockResolvedValue(undefined);
    mockExecuteOperation.mockResolvedValue({ items: [] });

    const event = {
      requestContext: {
        requestId: 'test-request-id',
        http: {
          method: 'POST',
          path: '/test',
        },
      },
      body: JSON.stringify({
        operation: 'findMany',
        collection: 'venues',
        params: { ids: ['123'] },
      }),
    } as APIGatewayProxyEventV2;

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(mockAuthHandler).toHaveBeenCalledWith(event, 'test-request-id');
    expect(mockExecuteOperation).toHaveBeenCalled();
  });

  it('POST以外のメソッド（OPTIONS, GET /version以外）でエラーを返す', async () => {
    const event = {
      requestContext: {
        requestId: 'test-request-id',
        http: {
          method: 'GET',
          path: '/other',
        },
      },
    } as APIGatewayProxyEventV2;

    const result = await handler(event);

    expect(result.statusCode).toBeGreaterThanOrEqual(400);
  });

  it('認証エラーでエラーレスポンスを返す', async () => {
    const mockAuthHandler = vi.mocked(authHandler.handleAuthentication);
    mockAuthHandler.mockRejectedValue(new Error('Authentication failed'));

    const event = {
      requestContext: {
        requestId: 'test-request-id',
        http: {
          method: 'POST',
          path: '/test',
        },
      },
      body: JSON.stringify({
        operation: 'findMany',
        collection: 'venues',
        params: { ids: ['123'] },
      }),
    } as APIGatewayProxyEventV2;

    const result = await handler(event);

    expect(result.statusCode).toBe(500);
  });
});
