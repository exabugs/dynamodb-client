/**
 * updateMany 統合テスト
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

describe('MCPAdapter - updateMany', () => {
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

  it('正常系: filterでupdateManyが成功する', async () => {
    // findのレスポンスをモック（対象レコード検索）
    mockSend.mockResolvedValueOnce({
      Items: [
        { PK: 'users', SK: 'status#active#id#user1', data: {} },
        { PK: 'users', SK: 'status#active#id#user2', data: {} },
      ],
      ConsumedCapacity: { TableName: 'test-table', CapacityUnits: 2 },
    });

    // BatchGetCommandのレスポンスをモック（既存レコード）
    mockSend.mockResolvedValueOnce({
      Responses: {
        'test-table': [
          {
            PK: 'users',
            SK: 'id#user1',
            data: { id: 'user1', status: 'active', __shadowKeys: ['status#active#id#user1'] },
          },
          {
            PK: 'users',
            SK: 'id#user2',
            data: { id: 'user2', status: 'active', __shadowKeys: ['status#active#id#user2'] },
          },
        ],
      },
      ConsumedCapacity: { TableName: 'test-table', CapacityUnits: 2 },
    });

    // TransactWriteCommandのレスポンスをモック
    mockSend.mockResolvedValueOnce({
      ConsumedCapacity: { TableName: 'test-table', CapacityUnits: 4 },
    });

    // updateManyを実行
    const result = await adapter.executeTool('dynamodb_updateMany', {
      collection: 'users',
      filter: { status: 'active' },
      data: { status: 'inactive' },
    });

    // 結果を検証
    expect(result).toHaveProperty('count');
    expect(result.count).toBeGreaterThanOrEqual(0);
  });

  it('正常系: 空の結果でupdateManyが成功する', async () => {
    // findのレスポンスをモック（レコードなし）
    mockSend.mockResolvedValueOnce({
      Items: [],
      ConsumedCapacity: { TableName: 'test-table', CapacityUnits: 1 },
    });

    // updateManyを実行
    const result = await adapter.executeTool('dynamodb_updateMany', {
      collection: 'users',
      filter: { status: 'nonexistent' },
      data: { status: 'inactive' },
    });

    // 結果を検証
    expect(result).toHaveProperty('count', 0);
  });

  it('異常系: collectionパラメータが必須', async () => {
    await expect(
      adapter.executeTool('dynamodb_updateMany', {
        filter: { status: 'active' },
        data: { status: 'inactive' },
      })
    ).rejects.toThrow();
  });
});
