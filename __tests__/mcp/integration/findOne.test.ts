/**
 * dynamodb_findOne ツールの統合テスト
 * MCPAdapter経由でfindOneツールを実行し、既存のhandleFindOne操作との統合を確認
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

describe('dynamodb_findOne integration', () => {
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

  describe('IDによる取得', () => {
    it('idを指定した場合、単一レコードを取得できる', async () => {
      // DynamoDB BatchGetCommandのレスポンスをモック
      mockSend.mockResolvedValue({
        Responses: {
          'test-table': [
            { PK: 'venues', SK: 'venues#123', data: { id: '123', name: 'Test Venue' } },
          ],
        },
        ConsumedCapacity: [{ TableName: 'test-table', CapacityUnits: 1 }],
      });

      const result = await adapter.executeTool('dynamodb_findOne', {
        collection: 'venues',
        filter: { id: '123' },
      });

      expect(result).toHaveProperty('id', '123');
      expect(result).toHaveProperty('name', 'Test Venue');
    });

    it('存在しないIDを指定した場合、エラーを投げる', async () => {
      // DynamoDB BatchGetCommandのレスポンスをモックして空の結果を返す
      mockSend.mockResolvedValue({
        Responses: {
          'test-table': [],
        },
        ConsumedCapacity: [{ TableName: 'test-table', CapacityUnits: 1 }],
      });

      await expect(
        adapter.executeTool('dynamodb_findOne', {
          collection: 'venues',
          filter: { id: 'nonexistent' },
        })
      ).rejects.toThrow('Record not found');
    });
  });

  describe('エラーハンドリング', () => {
    it('collectionが指定されていない場合、エラーを返す', async () => {
      await expect(
        adapter.executeTool('dynamodb_findOne', {
          filter: { id: '123' },
        })
      ).rejects.toThrow('Missing required parameter: collection');
    });

    it('DynamoDBエラーが発生した場合、適切なエラーを返す', async () => {
      const dynamoError = new Error('ResourceNotFoundException');
      dynamoError.name = 'ResourceNotFoundException';
      mockSend.mockRejectedValue(dynamoError);

      await expect(
        adapter.executeTool('dynamodb_findOne', {
          collection: 'venues',
          filter: { id: '123' },
        })
      ).rejects.toThrow();
    });
  });
});
