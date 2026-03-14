/**
 * find操作のコスト追跡テスト
 *
 * 要件: 9.1, 9.2, 10.3, 10.5
 *
 * このテストは、find操作のコスト追跡機能を検証します。
 * - 単一ページのコスト追跡
 * - 複数ページのコスト集計
 * - ConsumedCapacityが存在しない場合の処理
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// DynamoDBクライアントをモック
vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({
      send: vi.fn(),
    })),
  },
  QueryCommand: vi.fn(),
  BatchGetCommand: vi.fn(),
}));

// 環境変数をモック
process.env.DYNAMODB_TABLE_NAME = 'test-table';
process.env.SHADOW_CONFIG = JSON.stringify({
  venues: {
    name: { type: 'string' },
    status: { type: 'string' },
  },
});

describe('find operation cost tracking', () => {
  let mockSend: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // DynamoDBクライアントのsendメソッドをモック
    mockSend = vi.fn();

    vi.doMock('@aws-sdk/lib-dynamodb', () => ({
      DynamoDBDocumentClient: {
        from: vi.fn(() => ({
          send: mockSend,
        })),
      },
      QueryCommand: vi.fn((params) => params),
      BatchGetCommand: vi.fn((params) => params),
    }));

    // getDBClientをモック
    vi.doMock('../../../src/server/utils/dynamodb.js', () => ({
      getDBClient: () => ({
        send: mockSend,
      }),
      getTableName: () => 'test-table',
      executeDynamoDBOperation: async (fn: () => Promise<any>) => fn(),
      extractCleanRecord: (item: any) => item.data,
      removeShadowKeys: (data: Record<string, unknown>) => {
        const { __shadowKeys, ...rest } = data;
        return rest;
      },
    }));

    // ページネーションユーティリティをモック
    vi.doMock('../../../src/server/utils/pagination.js', () => ({
      decodeNextToken: (token: string) => JSON.parse(Buffer.from(token, 'base64').toString()),
      encodeNextToken: (pk: string, sk: string) =>
        Buffer.from(JSON.stringify({ PK: pk, SK: sk })).toString('base64'),
    }));

    // シャドーヘルパーをモック
    vi.doMock('../../../src/server/shadow/index.js', () => ({
      getShadowConfig: () => ({
        venues: {
          name: { type: 'string' },
          status: { type: 'string' },
        },
      }),
    }));
  });

  describe('ID最適化クエリ', () => {
    it('単一ページのコスト追跡が正しく動作する', async () => {
      // QueryCommandのレスポンスをモック
      mockSend.mockResolvedValueOnce({
        Items: [
          {
            PK: 'venues',
            SK: 'id#venue-1',
            data: {
              id: 'venue-1',
              name: 'Test Venue',
              status: 'active',
            },
          },
        ],
        ConsumedCapacity: {
          TableName: 'test-table',
          ReadCapacityUnits: 1.0,
          WriteCapacityUnits: 0,
        },
      });

      const { executeIdQuery } = await import('../../../src/server/operations/find/idQuery.js');

      const result = await executeIdQuery(
        'venues',
        {
          sort: { field: 'id', order: 'ASC' },
          pagination: { perPage: 10, nextToken: undefined },
          parsedFilters: [
            {
              parsed: { field: 'id', operator: '$eq', type: 'string' },
              value: 'venue-1',
            },
          ],
        },
        'test-request-id'
      );

      expect(result.items).toHaveLength(1);
      expect(result.consumedCapacity).toEqual({
        totalRCU: 1.0,
        totalWCU: 0,
        operationCount: 1,
      });
    });

    it('ConsumedCapacityが存在しない場合はゼロを返す', async () => {
      // ConsumedCapacityなしのレスポンスをモック
      mockSend.mockResolvedValueOnce({
        Items: [
          {
            PK: 'venues',
            SK: 'id#venue-1',
            data: {
              id: 'venue-1',
              name: 'Test Venue',
            },
          },
        ],
        // ConsumedCapacityなし
      });

      const { executeIdQuery } = await import('../../../src/server/operations/find/idQuery.js');

      const result = await executeIdQuery(
        'venues',
        {
          sort: { field: 'id', order: 'ASC' },
          pagination: { perPage: 10, nextToken: undefined },
          parsedFilters: [
            {
              parsed: { field: 'id', operator: '$eq', type: 'string' },
              value: 'venue-1',
            },
          ],
        },
        'test-request-id'
      );

      expect(result.items).toHaveLength(1);
      expect(result.consumedCapacity).toEqual({
        totalRCU: 0,
        totalWCU: 0,
        operationCount: 0,
      });
    });

    it('複数ページのコスト集計が正しく動作する', async () => {
      // 1ページ目のレスポンス
      mockSend.mockResolvedValueOnce({
        Items: [
          {
            PK: 'venues',
            SK: 'id#venue-1',
            data: { id: 'venue-1', name: 'Venue 1' },
          },
        ],
        LastEvaluatedKey: {
          PK: 'venues',
          SK: 'id#venue-1',
        },
        ConsumedCapacity: {
          ReadCapacityUnits: 2.5,
          WriteCapacityUnits: 0,
        },
      });

      const { executeIdQuery } = await import('../../../src/server/operations/find/idQuery.js');

      const result = await executeIdQuery(
        'venues',
        {
          sort: { field: 'id', order: 'ASC' },
          pagination: { perPage: 1, nextToken: undefined },
          parsedFilters: [],
        },
        'test-request-id'
      );

      expect(result.items).toHaveLength(1);
      expect(result.consumedCapacity).toEqual({
        totalRCU: 2.5,
        totalWCU: 0,
        operationCount: 1,
      });
      expect(result.pageInfo.hasNextPage).toBe(true);
    });
  });

  describe('シャドウレコードクエリ', () => {
    it('単一ページのコスト追跡が正しく動作する', async () => {
      // シャドウレコードのQueryレスポンス
      mockSend.mockResolvedValueOnce({
        Items: [
          {
            PK: 'venues',
            SK: 'name#Test Venue#id#venue-1',
          },
        ],
        ConsumedCapacity: {
          ReadCapacityUnits: 1.5,
          WriteCapacityUnits: 0,
        },
      });

      // 本体レコードのBatchGetレスポンス
      mockSend.mockResolvedValueOnce({
        Responses: {
          'test-table': [
            {
              PK: 'venues',
              SK: 'id#venue-1',
              data: {
                id: 'venue-1',
                name: 'Test Venue',
              },
            },
          ],
        },
        ConsumedCapacity: [
          {
            TableName: 'test-table',
            ReadCapacityUnits: 0.5,
            WriteCapacityUnits: 0,
          },
        ],
      });

      const { executeShadowQuery } =
        await import('../../../src/server/operations/find/shadowQuery.js');

      const result = await executeShadowQuery(
        'venues',
        {
          sort: { field: 'name', order: 'ASC' },
          pagination: { perPage: 10, nextToken: undefined },
          parsedFilters: [],
        },
        'test-request-id'
      );

      expect(result.items).toHaveLength(1);
      expect(result.consumedCapacity).toEqual({
        totalRCU: 2.0, // 1.5 (Query) + 0.5 (BatchGet)
        totalWCU: 0,
        operationCount: 2,
      });
    });

    it('複数のシャドウレコードのコスト集計が正しく動作する', async () => {
      // シャドウレコードのQueryレスポンス
      mockSend.mockResolvedValueOnce({
        Items: [
          { PK: 'venues', SK: 'name#Venue A#id#venue-1' },
          { PK: 'venues', SK: 'name#Venue B#id#venue-2' },
          { PK: 'venues', SK: 'name#Venue C#id#venue-3' },
        ],
        ConsumedCapacity: {
          ReadCapacityUnits: 3.0,
          WriteCapacityUnits: 0,
        },
      });

      // 本体レコードのBatchGetレスポンス
      mockSend.mockResolvedValueOnce({
        Responses: {
          'test-table': [
            { PK: 'venues', SK: 'id#venue-1', data: { id: 'venue-1', name: 'Venue A' } },
            { PK: 'venues', SK: 'id#venue-2', data: { id: 'venue-2', name: 'Venue B' } },
            { PK: 'venues', SK: 'id#venue-3', data: { id: 'venue-3', name: 'Venue C' } },
          ],
        },
        ConsumedCapacity: [
          {
            TableName: 'test-table',
            ReadCapacityUnits: 1.5,
            WriteCapacityUnits: 0,
          },
        ],
      });

      const { executeShadowQuery } =
        await import('../../../src/server/operations/find/shadowQuery.js');

      const result = await executeShadowQuery(
        'venues',
        {
          sort: { field: 'name', order: 'ASC' },
          pagination: { perPage: 10, nextToken: undefined },
          parsedFilters: [],
        },
        'test-request-id'
      );

      expect(result.items).toHaveLength(3);
      expect(result.consumedCapacity).toEqual({
        totalRCU: 4.5, // 3.0 (Query) + 1.5 (BatchGet)
        totalWCU: 0,
        operationCount: 2,
      });
    });

    it('ConsumedCapacityが配列形式の場合も正しく処理できる', async () => {
      // シャドウレコードのQueryレスポンス
      mockSend.mockResolvedValueOnce({
        Items: [{ PK: 'venues', SK: 'name#Test#id#venue-1' }],
        ConsumedCapacity: {
          ReadCapacityUnits: 1.0,
          WriteCapacityUnits: 0,
        },
      });

      // 本体レコードのBatchGetレスポンス（配列形式）
      mockSend.mockResolvedValueOnce({
        Responses: {
          'test-table': [{ PK: 'venues', SK: 'id#venue-1', data: { id: 'venue-1', name: 'Test' } }],
        },
        ConsumedCapacity: [
          {
            TableName: 'test-table',
            ReadCapacityUnits: 0.5,
            WriteCapacityUnits: 0,
          },
          {
            TableName: 'test-table',
            ReadCapacityUnits: 0.3,
            WriteCapacityUnits: 0,
          },
        ],
      });

      const { executeShadowQuery } =
        await import('../../../src/server/operations/find/shadowQuery.js');

      const result = await executeShadowQuery(
        'venues',
        {
          sort: { field: 'name', order: 'ASC' },
          pagination: { perPage: 10, nextToken: undefined },
          parsedFilters: [],
        },
        'test-request-id'
      );

      expect(result.items).toHaveLength(1);
      expect(result.consumedCapacity).toEqual({
        totalRCU: 1.8, // 1.0 (Query) + 0.5 + 0.3 (BatchGet配列)
        totalWCU: 0,
        operationCount: 3, // Query 1回 + BatchGet配列 2要素
      });
    });

    it('$startsフィルターがDynamoDB begins_with クエリに最適化される', async () => {
      // シャドウレコードのQueryレスポンス（typeDate プレフィックスで絞り込んだ結果）
      mockSend.mockResolvedValueOnce({
        Items: [
          { PK: 'venueStats', SK: 'typeDate#day:2026-03-14:0000000001#id#stat-1' },
        ],
        ConsumedCapacity: { ReadCapacityUnits: 1.0, WriteCapacityUnits: 0 },
      });

      // 本体レコードのBatchGetレスポンス
      mockSend.mockResolvedValueOnce({
        Responses: {
          'test-table': [
            {
              PK: 'venueStats',
              SK: 'id#stat-1',
              data: { id: 'stat-1', typeDate: 'day:2026-03-14:0000000001', total: 1 },
            },
          ],
        },
        ConsumedCapacity: [{ TableName: 'test-table', ReadCapacityUnits: 0.5, WriteCapacityUnits: 0 }],
      });

      const { executeShadowQuery } =
        await import('../../../src/server/operations/find/shadowQuery.js');

      await executeShadowQuery(
        'venueStats',
        {
          sort: { field: 'typeDate', order: 'DESC' },
          pagination: { perPage: 10, nextToken: undefined },
          parsedFilters: [
            {
              parsed: { field: 'typeDate', operator: '$starts', type: 'string' },
              value: 'day:2026-03-14:',
            },
          ],
        },
        'test-request-id'
      );

      // DynamoDB QueryCommand に正確なプレフィックスが渡されることを検証
      const queryParams = mockSend.mock.calls[0][0];
      expect(queryParams.KeyConditionExpression).toBe('PK = :pk AND begins_with(SK, :skValue)');
      // 'typeDate#' ではなく 'typeDate#day:2026-03-14:' で絞り込む
      expect(queryParams.ExpressionAttributeValues[':skValue']).toBe('typeDate#day:2026-03-14:');
    });
  });

  describe('エッジケース', () => {
    it('レコードが0件の場合もコスト情報を返す', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [],
        ConsumedCapacity: {
          ReadCapacityUnits: 0.5,
          WriteCapacityUnits: 0,
        },
      });

      const { executeIdQuery } = await import('../../../src/server/operations/find/idQuery.js');

      const result = await executeIdQuery(
        'venues',
        {
          sort: { field: 'id', order: 'ASC' },
          pagination: { perPage: 10, nextToken: undefined },
          parsedFilters: [],
        },
        'test-request-id'
      );

      expect(result.items).toHaveLength(0);
      expect(result.consumedCapacity).toEqual({
        totalRCU: 0.5,
        totalWCU: 0,
        operationCount: 1,
      });
    });

    it('RCUとWCUの両方が設定されている場合も正しく処理できる', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          {
            PK: 'venues',
            SK: 'id#venue-1',
            data: { id: 'venue-1', name: 'Test' },
          },
        ],
        ConsumedCapacity: {
          ReadCapacityUnits: 2.5,
          WriteCapacityUnits: 1.5,
        },
      });

      const { executeIdQuery } = await import('../../../src/server/operations/find/idQuery.js');

      const result = await executeIdQuery(
        'venues',
        {
          sort: { field: 'id', order: 'ASC' },
          pagination: { perPage: 10, nextToken: undefined },
          parsedFilters: [
            {
              parsed: { field: 'id', operator: '$eq', type: 'string' },
              value: 'venue-1',
            },
          ],
        },
        'test-request-id'
      );

      expect(result.consumedCapacity).toEqual({
        totalRCU: 2.5,
        totalWCU: 1.5,
        operationCount: 1,
      });
    });
  });
});
