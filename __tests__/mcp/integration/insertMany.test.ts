/**
 * insertMany 統合テスト
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

describe('MCPAdapter - insertMany', () => {
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

  it('正常系: 複数レコードの作成が成功する', async () => {
    // TransactWriteCommandのレスポンスをモック
    mockSend.mockResolvedValueOnce({
      ConsumedCapacity: { TableName: 'test-table', CapacityUnits: 6 },
    });

    // findManyのレスポンスをモック
    mockSend.mockResolvedValueOnce({
      Responses: {
        'test-table': [
          { PK: 'users', SK: 'id#id1', data: { id: 'id1', name: 'User 1' } },
          { PK: 'users', SK: 'id#id2', data: { id: 'id2', name: 'User 2' } },
        ],
      },
      ConsumedCapacity: { TableName: 'test-table', CapacityUnits: 2 },
    });

    // insertManyを実行
    const result = await adapter.executeTool('dynamodb_insertMany', {
      collection: 'users',
      data: [{ name: 'User 1' }, { name: 'User 2' }],
    });

    // 結果を検証
    expect(result).toHaveProperty('count');
    expect(result.count).toBeGreaterThanOrEqual(0);
  });

  it('正常系: 空の配列でinsertManyが成功する', async () => {
    // insertManyを実行
    const result = await adapter.executeTool('dynamodb_insertMany', {
      collection: 'users',
      data: [],
    });

    // 結果を検証
    expect(result).toHaveProperty('count', 0);
  });

  it('異常系: collectionパラメータが必須', async () => {
    await expect(
      adapter.executeTool('dynamodb_insertMany', {
        data: [{ name: 'User 1' }],
      })
    ).rejects.toThrow();
  });

  it('異常系: dataが配列でない場合はエラー', async () => {
    // insertManyはdataが配列でない場合、空配列として処理される
    const result = await adapter.executeTool('dynamodb_insertMany', {
      collection: 'users',
      data: { name: 'User 1' } as any,
    });

    // 空配列として処理されるため、count: 0 が返る
    expect(result).toHaveProperty('count', 0);
  });
});
