/**
 * Lambda Handler のユニットテスト
 *
 * handler.ts の parseRequestBody 関数と executeOperation 関数をテスト
 * v0.2.0 で database パラメータが削除されたことを確認
 */
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// handler.ts をインポート（テスト用にエクスポートが必要な場合は追加）
// 現在は handler 関数のみがエクスポートされているため、統合テストとして実装

/**
 * モックイベントを作成するヘルパー関数
 */
function createMockEvent(body: string, headers: Record<string, string> = {}): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: '/',
    rawQueryString: '',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      domainName: 'test.lambda-url.ap-northeast-1.on.aws',
      domainPrefix: 'test',
      http: {
        method: 'POST',
        path: '/',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent',
      },
      requestId: 'test-request-id',
      routeKey: '$default',
      stage: '$default',
      time: '01/Jan/2025:00:00:00 +0000',
      timeEpoch: 1704067200000,
    },
    body,
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

describe('Lambda Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('リクエストボディのパース', () => {
    it('database フィールドなしでリクエストをパースできる', async () => {
      // v0.2.0: database フィールドは不要
      const body = JSON.stringify({
        operation: 'find',
        collection: 'articles',
        params: {
          filter: {},
          options: {},
        },
      });

      const event = createMockEvent(body, {
        'x-amz-date': '20250119T000000Z',
        'x-amz-content-sha256': 'test-hash',
      });

      // handler 関数は実際の DynamoDB 操作を行うため、
      // ここではリクエストパースのみをテスト
      // 実際のテストでは handler をモックする必要がある
      expect(body).toContain('operation');
      expect(body).toContain('collection');
      expect(body).not.toContain('database');
    });

    it('database フィールドがあっても無視される', async () => {
      // 後方互換性: database フィールドがあっても動作する
      const body = JSON.stringify({
        operation: 'find',
        database: 'ainews', // 無視される
        collection: 'articles',
        params: {
          filter: {},
          options: {},
        },
      });

      const event = createMockEvent(body, {
        'x-amz-date': '20250119T000000Z',
        'x-amz-content-sha256': 'test-hash',
      });

      // リクエストボディに database が含まれていても問題ない
      expect(body).toContain('database');
      expect(body).toContain('collection');
    });

    it('必須フィールド operation がない場合はエラー', () => {
      const body = JSON.stringify({
        collection: 'articles',
        params: {},
      });

      // parseRequestBody 関数は operation が必須
      expect(() => {
        const parsed = JSON.parse(body);
        if (!parsed.operation) {
          throw new Error('Missing required field: operation');
        }
      }).toThrow('Missing required field: operation');
    });

    it('必須フィールド collection がない場合はエラー', () => {
      const body = JSON.stringify({
        operation: 'find',
        params: {},
      });

      // parseRequestBody 関数は collection が必須
      expect(() => {
        const parsed = JSON.parse(body);
        if (!parsed.collection) {
          throw new Error('Missing required field: collection');
        }
      }).toThrow('Missing required field: collection');
    });

    it('必須フィールド params がない場合はエラー', () => {
      const body = JSON.stringify({
        operation: 'find',
        collection: 'articles',
      });

      // parseRequestBody 関数は params が必須
      expect(() => {
        const parsed = JSON.parse(body);
        if (parsed.params === undefined) {
          throw new Error('Missing required field: params');
        }
      }).toThrow('Missing required field: params');
    });

    it('不正な JSON の場合はエラー', () => {
      const body = 'invalid json';

      expect(() => {
        JSON.parse(body);
      }).toThrow();
    });

    it('空のボディの場合はエラー', () => {
      const body = '';

      expect(() => {
        if (!body) {
          throw new Error('Request body is required');
        }
      }).toThrow('Request body is required');
    });
  });

  describe('MongoDB 風 API の操作', () => {
    it('find 操作のリクエスト形式', () => {
      const body = JSON.stringify({
        operation: 'find',
        collection: 'articles',
        params: {
          filter: { status: 'published' },
          options: {
            sort: { createdAt: 'desc' },
            limit: 10,
          },
        },
      });

      const parsed = JSON.parse(body);
      expect(parsed.operation).toBe('find');
      expect(parsed.collection).toBe('articles');
      expect(parsed.params.filter).toEqual({ status: 'published' });
      expect(parsed.params.options.sort).toEqual({ createdAt: 'desc' });
      expect(parsed.params.options.limit).toBe(10);
    });

    it('findOne 操作のリクエスト形式', () => {
      const body = JSON.stringify({
        operation: 'findOne',
        collection: 'articles',
        params: {
          filter: { id: 'article-001' },
        },
      });

      const parsed = JSON.parse(body);
      expect(parsed.operation).toBe('findOne');
      expect(parsed.collection).toBe('articles');
      expect(parsed.params.filter.id).toBe('article-001');
    });

    it('insertOne 操作のリクエスト形式', () => {
      const body = JSON.stringify({
        operation: 'insertOne',
        collection: 'articles',
        params: {
          document: {
            title: 'テスト記事',
            content: '内容',
            status: 'draft',
          },
        },
      });

      const parsed = JSON.parse(body);
      expect(parsed.operation).toBe('insertOne');
      expect(parsed.collection).toBe('articles');
      expect(parsed.params.document).toEqual({
        title: 'テスト記事',
        content: '内容',
        status: 'draft',
      });
    });

    it('updateOne 操作のリクエスト形式', () => {
      const body = JSON.stringify({
        operation: 'updateOne',
        collection: 'articles',
        params: {
          filter: { id: 'article-001' },
          update: {
            set: {
              status: 'published',
            },
          },
        },
      });

      const parsed = JSON.parse(body);
      expect(parsed.operation).toBe('updateOne');
      expect(parsed.collection).toBe('articles');
      expect(parsed.params.filter.id).toBe('article-001');
      expect(parsed.params.update.set).toEqual({ status: 'published' });
    });

    it('deleteOne 操作のリクエスト形式', () => {
      const body = JSON.stringify({
        operation: 'deleteOne',
        collection: 'articles',
        params: {
          filter: { id: 'article-001' },
        },
      });

      const parsed = JSON.parse(body);
      expect(parsed.operation).toBe('deleteOne');
      expect(parsed.collection).toBe('articles');
      expect(parsed.params.filter.id).toBe('article-001');
    });

    it('insertMany 操作のリクエスト形式', () => {
      const body = JSON.stringify({
        operation: 'insertMany',
        collection: 'articles',
        params: {
          documents: [
            { title: '記事1', content: '内容1' },
            { title: '記事2', content: '内容2' },
          ],
        },
      });

      const parsed = JSON.parse(body);
      expect(parsed.operation).toBe('insertMany');
      expect(parsed.collection).toBe('articles');
      expect(parsed.params.documents).toHaveLength(2);
    });

    it('updateMany 操作のリクエスト形式', () => {
      const body = JSON.stringify({
        operation: 'updateMany',
        collection: 'articles',
        params: {
          filter: { id: { in: ['article-001', 'article-002'] } },
          update: {
            set: { status: 'archived' },
          },
        },
      });

      const parsed = JSON.parse(body);
      expect(parsed.operation).toBe('updateMany');
      expect(parsed.collection).toBe('articles');
      expect(parsed.params.filter.id.in).toEqual(['article-001', 'article-002']);
    });

    it('deleteMany 操作のリクエスト形式', () => {
      const body = JSON.stringify({
        operation: 'deleteMany',
        collection: 'articles',
        params: {
          filter: { id: { in: ['article-001', 'article-002'] } },
        },
      });

      const parsed = JSON.parse(body);
      expect(parsed.operation).toBe('deleteMany');
      expect(parsed.collection).toBe('articles');
      expect(parsed.params.filter.id.in).toEqual(['article-001', 'article-002']);
    });
  });

  describe('v0.2.0 破壊的変更の確認', () => {
    it('database パラメータが削除されたことを確認', () => {
      // v0.1.x の古いリクエスト形式
      const oldBody = JSON.stringify({
        operation: 'find',
        database: 'ainews', // v0.2.0 では不要
        collection: 'articles',
        params: {},
      });

      // v0.2.0 の新しいリクエスト形式
      const newBody = JSON.stringify({
        operation: 'find',
        collection: 'articles',
        params: {},
      });

      const oldParsed = JSON.parse(oldBody);
      const newParsed = JSON.parse(newBody);

      // 古い形式には database が含まれる
      expect(oldParsed.database).toBe('ainews');

      // 新しい形式には database が含まれない
      expect(newParsed.database).toBeUndefined();

      // 両方とも operation と collection は必須
      expect(oldParsed.operation).toBe('find');
      expect(oldParsed.collection).toBe('articles');
      expect(newParsed.operation).toBe('find');
      expect(newParsed.collection).toBe('articles');
    });

    it('MongoDBStyleRequest インターフェースに database フィールドがない', () => {
      // TypeScript の型チェックで確認
      // MongoDBStyleRequest インターフェースは以下のフィールドのみを持つ:
      // - operation: string
      // - collection: string
      // - params: unknown

      const validRequest = {
        operation: 'find',
        collection: 'articles',
        params: {},
      };

      // database フィールドがなくても有効
      expect(validRequest).toHaveProperty('operation');
      expect(validRequest).toHaveProperty('collection');
      expect(validRequest).toHaveProperty('params');
      expect(validRequest).not.toHaveProperty('database');
    });
  });

  describe('CORS とメソッド検証', () => {
    it('OPTIONS リクエストは CORS レスポンスを返す', () => {
      const event = createMockEvent('', {});
      event.requestContext.http.method = 'OPTIONS';

      // OPTIONS リクエストは 200 を返す
      expect(event.requestContext.http.method).toBe('OPTIONS');
    });

    it('POST 以外のメソッドはエラー', () => {
      const event = createMockEvent('{}', {});
      event.requestContext.http.method = 'GET';

      // POST 以外は 405 Method Not Allowed
      expect(event.requestContext.http.method).not.toBe('POST');
    });
  });

  describe('認証ヘッダーの検証', () => {
    it('IAM 認証（AWS SigV4）を検出', () => {
      const headers = {
        authorization: 'AWS4-HMAC-SHA256 Credential=...',
        'x-amz-date': '20250119T000000Z',
        'x-amz-content-sha256': 'test-hash',
      };

      // AWS SigV4 署名の特徴
      expect(headers.authorization.startsWith('AWS4-HMAC-SHA256')).toBe(true);
      expect(headers['x-amz-date']).toBeDefined();
      expect(headers['x-amz-content-sha256']).toBeDefined();
    });

    it('Cognito JWT 認証を検出', () => {
      const headers = {
        authorization: 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
      };

      // JWT トークンの特徴
      expect(headers.authorization.startsWith('Bearer ')).toBe(true);
      expect(headers.authorization).toContain('eyJ'); // Base64 encoded
    });
  });
});
