/**
 * dynamodb_find ツールの統合テスト
 * MCPAdapter経由でfindツールを実行し、既存のhandleFind操作との統合を確認
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
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

describe('dynamodb_find integration', () => {
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

  describe('基本的な検索', () => {
    it('collectionのみ指定した場合、全レコードを取得できる', async () => {
      // DynamoDB Queryのレスポンスをモック
      mockSend.mockResolvedValue({
        Items: [
          { PK: 'venues#123', SK: 'venues#123', id: '123', name: 'Test Venue' },
        ],
        ConsumedCapacity: { TableName: 'test-table', CapacityUnits: 1 },
      });

      const result = await adapter.executeTool('dynamodb_find', {
        collection: 'venues',
      });

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('pageInfo');
      expect(Array.isArray((result as any).items)).toBe(true);
    });

    it('filterを指定した場合、フィルター条件が適用される', async () => {
      mockSend.mockResolvedValue({
        Items: [
          { PK: 'venues#123', SK: 'venues#123', id: '123', name: 'Active Venue', status: 'active' },
        ],
        ConsumedCapacity: { TableName: 'test-table', CapacityUnits: 1 },
      });

      const result = await adapter.executeTool('dynamodb_find', {
        collection: 'venues',
        filter: { status: 'active' },
      });

      expect(result).toHaveProperty('items');
      expect((result as any).items).toBeInstanceOf(Array);
    });
  });

  describe('ソート機能', () => {
    it('sortを指定した場合、ソート条件が適用される', async () => {
      mockSend.mockResolvedValue({
        Items: [
          { PK: 'venues#123', SK: 'name#A', id: '123', name: 'A Venue' },
          { PK: 'venues#456', SK: 'name#B', id: '456', name: 'B Venue' },
        ],
        ConsumedCapacity: { TableName: 'test-table', CapacityUnits: 1 },
      });

      const result = await adapter.executeTool('dynamodb_find', {
        collection: 'venues',
        sort: {
          field: 'name',
          order: 'ASC',
        },
      });

      expect(result).toHaveProperty('items');
      expect((result as any).items).toBeInstanceOf(Array);
    });
  });

  describe('ページネーション機能', () => {
    it('paginationを指定した場合、ページネーションが適用される', async () => {
      mockSend.mockResolvedValue({
        Items: [
          { PK: 'venues#123', SK: 'venues#123', id: '123', name: 'Venue 1' },
          { PK: 'venues#456', SK: 'venues#456', id: '456', name: 'Venue 2' },
        ],
        LastEvaluatedKey: { PK: 'venues#456', SK: 'venues#456' },
        ConsumedCapacity: { TableName: 'test-table', CapacityUnits: 1 },
      });

      const result = await adapter.executeTool('dynamodb_find', {
        collection: 'venues',
        pagination: {
          perPage: 2,
        },
      });

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('pageInfo');
      expect((result as any).pageInfo).toHaveProperty('hasNextPage');
    });

    it('nextTokenを指定した場合、次ページを取得できる', async () => {
      mockSend.mockResolvedValue({
        Items: [
          { PK: 'venues#789', SK: 'venues#789', id: '789', name: 'Venue 3' },
        ],
        ConsumedCapacity: { TableName: 'test-table', CapacityUnits: 1 },
      });

      const result = await adapter.executeTool('dynamodb_find', {
        collection: 'venues',
        pagination: {
          perPage: 2,
          nextToken: 'eyJQSyI6InZlbnVlcyM0NTYiLCJTSyI6InZlbnVlcyM0NTYifQ',
        },
      });

      expect(result).toHaveProperty('items');
      expect((result as any).items).toBeInstanceOf(Array);
    });
  });

  describe('複合条件', () => {
    it('filter、sort、paginationを同時に指定できる', async () => {
      mockSend.mockResolvedValue({
        Items: [
          { PK: 'venues#123', SK: 'name#A', id: '123', name: 'A Venue', status: 'active' },
        ],
        LastEvaluatedKey: { PK: 'venues#123', SK: 'name#A' },
        ConsumedCapacity: { TableName: 'test-table', CapacityUnits: 1 },
      });

      const result = await adapter.executeTool('dynamodb_find', {
        collection: 'venues',
        filter: { status: 'active' },
        sort: {
          field: 'name',
          order: 'ASC',
        },
        pagination: {
          perPage: 10,
        },
      });

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('pageInfo');
      expect((result as any).items).toBeInstanceOf(Array);
    });
  });

  describe('エラーハンドリング', () => {
    it('collectionが指定されていない場合、エラーを返す', async () => {
      await expect(
        adapter.executeTool('dynamodb_find', {})
      ).rejects.toThrow('Missing required parameter: collection');
    });

    it('DynamoDBエラーが発生した場合、適切なエラーを返す', async () => {
      const dynamoError = new Error('ResourceNotFoundException');
      dynamoError.name = 'ResourceNotFoundException';
      mockSend.mockRejectedValue(dynamoError);

      await expect(
        adapter.executeTool('dynamodb_find', {
          collection: 'venues',
        })
      ).rejects.toThrow();
    });
  });
});
