/**
 * findManyReference 統合テスト
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

describe('MCPAdapter - findManyReference', () => {
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

  it('正常系: target/idでfindManyReferenceが成功する', async () => {
    // DynamoDB QueryCommandのレスポンスをモック（シャドーレコード）
    mockSend.mockResolvedValueOnce({
      Items: [
        { PK: 'participations', SK: 'userId#user1#id#p1', data: {} },
        { PK: 'participations', SK: 'userId#user1#id#p2', data: {} },
      ],
      ConsumedCapacity: { TableName: 'test-table', CapacityUnits: 2 },
    });

    // DynamoDB BatchGetCommandのレスポンスをモック（メインレコード）
    mockSend.mockResolvedValueOnce({
      Responses: {
        'test-table': [
          {
            PK: 'participations',
            SK: 'id#p1',
            data: { id: 'p1', userId: 'user1', status: 'confirmed' },
          },
          {
            PK: 'participations',
            SK: 'id#p2',
            data: { id: 'p2', userId: 'user1', status: 'confirmed' },
          },
        ],
      },
      ConsumedCapacity: { TableName: 'test-table', CapacityUnits: 2 },
    });

    // findManyReferenceを実行
    const result = await adapter.executeTool('dynamodb_findManyReference', {
      collection: 'participations',
      target: 'userId',
      id: 'user1',
    });

    // 結果を検証
    expect(result).toHaveProperty('items');
    expect(result.items).toBeInstanceOf(Array);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toHaveProperty('id', 'p1');
    expect(result.items[1]).toHaveProperty('id', 'p2');

    // API呼び出しを検証（Query + BatchGet）
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it('正常系: filterを追加してfindManyReferenceが成功する', async () => {
    // DynamoDB QueryCommandのレスポンスをモック
    mockSend.mockResolvedValueOnce({
      Items: [
        { PK: 'participations', SK: 'userId#user1#id#p1', data: {} },
        { PK: 'participations', SK: 'userId#user1#id#p2', data: {} },
      ],
      ConsumedCapacity: { TableName: 'test-table', CapacityUnits: 2 },
    });

    // DynamoDB BatchGetCommandのレスポンスをモック
    mockSend.mockResolvedValueOnce({
      Responses: {
        'test-table': [
          {
            PK: 'participations',
            SK: 'id#p1',
            data: { id: 'p1', userId: 'user1', status: 'confirmed' },
          },
          {
            PK: 'participations',
            SK: 'id#p2',
            data: { id: 'p2', userId: 'user1', status: 'pending' },
          },
        ],
      },
      ConsumedCapacity: { TableName: 'test-table', CapacityUnits: 2 },
    });

    // findManyReferenceを実行（filterでstatusを指定）
    const result = await adapter.executeTool('dynamodb_findManyReference', {
      collection: 'participations',
      target: 'userId',
      id: 'user1',
      filter: { status: 'confirmed' },
    });

    // 結果を検証（filterが適用されて1件のみ）
    expect(result).toHaveProperty('items');
    expect(result.items).toBeInstanceOf(Array);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toHaveProperty('status', 'confirmed');
  });

  it('正常系: 空の結果でfindManyReferenceが成功する', async () => {
    // DynamoDB QueryCommandのレスポンスをモック（空）
    mockSend.mockResolvedValueOnce({
      Items: [],
      ConsumedCapacity: { TableName: 'test-table', CapacityUnits: 1 },
    });

    // findManyReferenceを実行
    const result = await adapter.executeTool('dynamodb_findManyReference', {
      collection: 'participations',
      target: 'userId',
      id: 'nonexistent',
    });

    // 結果を検証
    expect(result).toHaveProperty('items');
    expect(result.items).toBeInstanceOf(Array);
    expect(result.items).toHaveLength(0);

    // API呼び出しを検証（Queryのみ）
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('異常系: collectionパラメータが必須', async () => {
    // collectionなしで実行
    await expect(
      adapter.executeTool('dynamodb_findManyReference', {
        target: 'userId',
        id: 'user1',
      })
    ).rejects.toThrow();
  });

  it('異常系: targetパラメータが必須', async () => {
    // targetなしで実行
    await expect(
      adapter.executeTool('dynamodb_findManyReference', {
        collection: 'participations',
        id: 'user1',
      })
    ).rejects.toThrow();
  });

  it('異常系: idパラメータが必須', async () => {
    // idなしで実行
    await expect(
      adapter.executeTool('dynamodb_findManyReference', {
        collection: 'participations',
        target: 'userId',
      })
    ).rejects.toThrow();
  });

  it('異常系: DynamoDBエラーが発生した場合', async () => {
    // DynamoDBエラーをシミュレート
    mockSend.mockRejectedValueOnce(new Error('DynamoDB error'));

    // findManyReferenceを実行
    await expect(
      adapter.executeTool('dynamodb_findManyReference', {
        collection: 'participations',
        target: 'userId',
        id: 'user1',
      })
    ).rejects.toThrow();
  });

  it('正常系: ページネーションが機能する', async () => {
    // DynamoDB QueryCommandのレスポンスをモック（nextTokenあり）
    mockSend.mockResolvedValueOnce({
      Items: [{ PK: 'participations', SK: 'userId#user1#id#p1', data: {} }],
      LastEvaluatedKey: { PK: 'participations', SK: 'userId#user1#id#p1' },
      ConsumedCapacity: { TableName: 'test-table', CapacityUnits: 1 },
    });

    // DynamoDB BatchGetCommandのレスポンスをモック
    mockSend.mockResolvedValueOnce({
      Responses: {
        'test-table': [
          {
            PK: 'participations',
            SK: 'id#p1',
            data: { id: 'p1', userId: 'user1', status: 'confirmed' },
          },
        ],
      },
      ConsumedCapacity: { TableName: 'test-table', CapacityUnits: 1 },
    });

    // findManyReferenceを実行
    const result = await adapter.executeTool('dynamodb_findManyReference', {
      collection: 'participations',
      target: 'userId',
      id: 'user1',
    });

    // 結果を検証
    expect(result).toHaveProperty('pageInfo');
    expect(result.pageInfo.hasNextPage).toBe(true);
    expect(result).toHaveProperty('nextToken');
  });
});
