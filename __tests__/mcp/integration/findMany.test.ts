/**
 * findMany 統合テスト
 */
import { McpError } from '@modelcontextprotocol/sdk/types.js';
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

describe('MCPAdapter - findMany', () => {
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

  it('正常系: idsでfindManyが成功する', async () => {
    // DynamoDB BatchGetCommandのレスポンスをモック
    mockSend.mockResolvedValueOnce({
      Responses: {
        'test-table': [
          { PK: 'users', SK: 'id#id1', data: { id: 'id1', name: 'Record 1' } },
          { PK: 'users', SK: 'id#id2', data: { id: 'id2', name: 'Record 2' } },
        ],
      },
      ConsumedCapacity: { TableName: 'test-table', CapacityUnits: 2 },
    });

    // findManyを実行
    const result = await adapter.executeTool('dynamodb_findMany', {
      collection: 'users',
      ids: ['id1', 'id2'],
    });

    // 結果を検証
    expect(result).toBeInstanceOf(Array);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveProperty('id', 'id1');
    expect(result[1]).toHaveProperty('id', 'id2');

    // API呼び出しを検証
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('正常系: 空のidsでfindManyが成功する', async () => {
    // findManyを実行
    const result = await adapter.executeTool('dynamodb_findMany', {
      collection: 'users',
      ids: [],
    });

    // 結果を検証
    expect(result).toBeInstanceOf(Array);
    expect(result).toHaveLength(0);

    // API呼び出しがないことを確認
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('異常系: collectionパラメータが必須', async () => {
    // collectionなしで実行
    await expect(
      adapter.executeTool('dynamodb_findMany', {
        ids: ['id1', 'id2'],
      })
    ).rejects.toThrow();
  });

  it('異常系: idsが配列でない場合はエラー', async () => {
    // idsが文字列の場合
    await expect(
      adapter.executeTool('dynamodb_findMany', {
        collection: 'users',
        ids: 'id1' as any,
      })
    ).rejects.toThrow();
  });

  it('異常系: DynamoDBエラーが発生した場合', async () => {
    // DynamoDBエラーをシミュレート
    mockSend.mockRejectedValueOnce(new Error('DynamoDB error'));

    // findManyを実行
    await expect(
      adapter.executeTool('dynamodb_findMany', {
        collection: 'users',
        ids: ['id1', 'id2'],
      })
    ).rejects.toThrow();
  });

  it('正常系: 大量のIDでfindManyが成功する', async () => {
    // 100件のレコードをモック
    const mockRecords = Array.from({ length: 100 }, (_, i) => ({
      PK: 'users',
      SK: `id#id${i}`,
      data: { id: `id${i}`, name: `Record ${i}` },
    }));

    mockSend.mockResolvedValueOnce({
      Responses: {
        'test-table': mockRecords,
      },
      ConsumedCapacity: { TableName: 'test-table', CapacityUnits: 100 },
    });

    // 100件のIDでfindManyを実行
    const ids = Array.from({ length: 100 }, (_, i) => `id${i}`);
    const result = await adapter.executeTool('dynamodb_findMany', {
      collection: 'users',
      ids,
    });

    // 結果を検証
    expect(result).toBeInstanceOf(Array);
    expect(result).toHaveLength(100);
    expect(result[0]).toHaveProperty('id', 'id0');
    expect(result[99]).toHaveProperty('id', 'id99');
  });
});
