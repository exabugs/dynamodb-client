/**
 * dynamodb_insertOne ツールの統合テスト
 * MCPAdapter経由でinsertOneツールを実行し、既存のhandleInsertOne操作との統合を確認
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MCPAdapter } from '../../../src/mcp/adapter.js';
import type { MCPServerConfig } from '../../../src/mcp/types.js';

// DynamoDBクライアントをモック
const mockSend = vi.fn();
const mockClient = {
  send: mockSend,
};

vi.mock('../../../src/shared/index.js', async () => {
  const actual = await vi.importActual('../../../src/shared/index.js');
  return {
    ...actual,
    createDynamoDBClient: vi.fn(() => mockClient),
  };
});

describe('dynamodb_insertOne integration', () => {
  let adapter: MCPAdapter;
  let config: MCPServerConfig;

  beforeEach(() => {
    config = {
      tableName: 'test-table',
      region: 'us-east-1',
    };
    adapter = new MCPAdapter(config);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('基本的な作成', () => {
    it('dataを指定した場合、レコードを作成できる', async () => {
      const testData = {
        name: 'Test Venue',
        status: 'active',
        location: {
          lat: 35.6812,
          lng: 139.7671,
        },
      };
      const generatedId = '01KGXER63MQND5XQPD403QM9E0';

      // TransactWriteCommandのレスポンスをモック（insertMany内部で使用）
      mockSend.mockResolvedValueOnce({
        ConsumedCapacity: [{ TableName: 'test-table', CapacityUnits: 1 }],
      });

      // BatchGetCommandのレスポンスをモック（findMany内部で使用）
      mockSend.mockResolvedValueOnce({
        Responses: {
          'test-table': [
            {
              PK: 'venues',
              SK: `venues#${generatedId}`,
              data: {
                id: generatedId,
                ...testData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            },
          ],
        },
        ConsumedCapacity: [{ TableName: 'test-table', CapacityUnits: 1 }],
      });

      const result = await adapter.executeTool('dynamodb_insertOne', {
        collection: 'venues',
        data: testData,
      });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name', 'Test Venue');
      expect(result).toHaveProperty('status', 'active');
      expect(result).toHaveProperty('location');
      expect((result as any).location).toEqual({
        lat: 35.6812,
        lng: 139.7671,
      });
    });

    it('IDが自動生成される', async () => {
      const generatedId = '01KGXERF74283A3GRVW325EQZD';

      // TransactWriteCommandのレスポンスをモック
      mockSend.mockResolvedValueOnce({
        ConsumedCapacity: [{ TableName: 'test-table', CapacityUnits: 1 }],
      });

      // BatchGetCommandのレスポンスをモック
      mockSend.mockResolvedValueOnce({
        Responses: {
          'test-table': [
            {
              PK: 'venues',
              SK: `venues#${generatedId}`,
              data: {
                id: generatedId,
                name: 'Auto ID Venue',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            },
          ],
        },
        ConsumedCapacity: [{ TableName: 'test-table', CapacityUnits: 1 }],
      });

      const result = await adapter.executeTool('dynamodb_insertOne', {
        collection: 'venues',
        data: {
          name: 'Auto ID Venue',
        },
      });

      expect(result).toHaveProperty('id');
      expect(typeof (result as any).id).toBe('string');
      expect((result as any).id.length).toBeGreaterThan(0);
    });

    it('空のdataでもレコードを作成できる', async () => {
      const generatedId = '01KGXER63W6EJAM66TPY8G099R';

      // TransactWriteCommandのレスポンスをモック
      mockSend.mockResolvedValueOnce({
        ConsumedCapacity: [{ TableName: 'test-table', CapacityUnits: 1 }],
      });

      // BatchGetCommandのレスポンスをモック
      mockSend.mockResolvedValueOnce({
        Responses: {
          'test-table': [
            {
              PK: 'venues',
              SK: `venues#${generatedId}`,
              data: {
                id: generatedId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            },
          ],
        },
        ConsumedCapacity: [{ TableName: 'test-table', CapacityUnits: 1 }],
      });

      const result = await adapter.executeTool('dynamodb_insertOne', {
        collection: 'venues',
        data: {},
      });

      expect(result).toHaveProperty('id');
    });
  });

  describe('複雑なデータ構造', () => {
    it('ネストされたオブジェクトを含むデータを作成できる', async () => {
      const complexData = {
        name: 'Complex Venue',
        metadata: {
          tags: ['outdoor', 'sports'],
          capacity: 100,
          facilities: {
            parking: true,
            wifi: true,
          },
        },
      };
      const generatedId = '01KGXER63XXHRQEW8CJA4TSKHB';

      // TransactWriteCommandのレスポンスをモック
      mockSend.mockResolvedValueOnce({
        ConsumedCapacity: [{ TableName: 'test-table', CapacityUnits: 1 }],
      });

      // BatchGetCommandのレスポンスをモック
      mockSend.mockResolvedValueOnce({
        Responses: {
          'test-table': [
            {
              PK: 'venues',
              SK: `venues#${generatedId}`,
              data: {
                id: generatedId,
                ...complexData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            },
          ],
        },
        ConsumedCapacity: [{ TableName: 'test-table', CapacityUnits: 1 }],
      });

      const result = await adapter.executeTool('dynamodb_insertOne', {
        collection: 'venues',
        data: complexData,
      });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name', 'Complex Venue');
      expect(result).toHaveProperty('metadata');
      expect((result as any).metadata).toEqual(complexData.metadata);
    });

    it('配列を含むデータを作成できる', async () => {
      const dataWithArray = {
        name: 'Array Venue',
        tags: ['tag1', 'tag2', 'tag3'],
        coordinates: [35.6812, 139.7671],
      };
      const generatedId = '01KGXER63XZ5E5S9PZH11ZVQNY';

      // TransactWriteCommandのレスポンスをモック
      mockSend.mockResolvedValueOnce({
        ConsumedCapacity: [{ TableName: 'test-table', CapacityUnits: 1 }],
      });

      // BatchGetCommandのレスポンスをモック
      mockSend.mockResolvedValueOnce({
        Responses: {
          'test-table': [
            {
              PK: 'venues',
              SK: `venues#${generatedId}`,
              data: {
                id: generatedId,
                ...dataWithArray,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            },
          ],
        },
        ConsumedCapacity: [{ TableName: 'test-table', CapacityUnits: 1 }],
      });

      const result = await adapter.executeTool('dynamodb_insertOne', {
        collection: 'venues',
        data: dataWithArray,
      });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('tags');
      expect(Array.isArray((result as any).tags)).toBe(true);
      expect((result as any).tags).toEqual(['tag1', 'tag2', 'tag3']);
    });
  });

  describe('エラーハンドリング', () => {
    it('collectionが指定されていない場合、エラーを返す', async () => {
      await expect(
        adapter.executeTool('dynamodb_insertOne', {
          data: { name: 'Test' },
        })
      ).rejects.toThrow('Missing required parameter: collection');
    });

    it('DynamoDBエラーが発生した場合、適切なエラーを返す', async () => {
      const dynamoError = new Error('ValidationException');
      dynamoError.name = 'ValidationException';
      mockSend.mockRejectedValue(dynamoError);

      await expect(
        adapter.executeTool('dynamodb_insertOne', {
          collection: 'venues',
          data: { name: 'Test Venue' },
        })
      ).rejects.toThrow();
    });

    it('認証エラーが発生した場合、適切なエラーを返す', async () => {
      const authError = new Error('AccessDeniedException');
      authError.name = 'AccessDeniedException';
      mockSend.mockRejectedValue(authError);

      await expect(
        adapter.executeTool('dynamodb_insertOne', {
          collection: 'venues',
          data: { name: 'Test Venue' },
        })
      ).rejects.toThrow();
    });
  });
});
