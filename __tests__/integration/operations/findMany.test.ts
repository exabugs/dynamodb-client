/**
 * findMany 統合テスト
 *
 * DynamoDBモックを使用してfindMany操作をテスト
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { handleFindMany } from '../../../src/server/operations/findMany.js';
import { handleInsertOne } from '../../../src/server/operations/insertOne.js';
import { DynamoDBMock } from '../../helpers/dynamodb-mock.js';
import { testDataFactory } from '../../helpers/factories.js';

// DynamoDBモックインスタンス
let mockDynamoClient: DynamoDBMock;

// モジュール全体をモック
vi.mock('../../../src/server/utils/dynamodb.ts', () => ({
  getDBClient: vi.fn(() => mockDynamoClient),
  getTableName: vi.fn(() => 'test-table'),
  removeShadowKeys: vi.fn((record: Record<string, unknown>) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { __shadowKeys, ...rest } = record;
    return rest;
  }),
  extractCleanRecord: vi.fn((item: Record<string, unknown>) => {
    const data = (item.data as Record<string, unknown>) || item;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { __shadowKeys, ...rest } = data;
    return rest;
  }),
  executeDynamoDBOperation: vi.fn(async (operation: () => Promise<unknown>) => await operation()),
}));

describe('findMany - Integration Tests', () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    mockDynamoClient = new DynamoDBMock();
    mockDynamoClient.createTable('test-table');
  });

  afterEach(() => {
    mockDynamoClient.clear();
  });

  describe('正常系', () => {
    it('IDリストで複数レコードを取得できる', async () => {
      // 複数のレコードを作成
      const user1 = testDataFactory.createUser({ name: 'Alice' });
      const user2 = testDataFactory.createUser({ name: 'Bob' });
      const user3 = testDataFactory.createUser({ name: 'Charlie' });

      const created1 = await handleInsertOne('users', { data: user1 }, 'test-request-id');
      const created2 = await handleInsertOne('users', { data: user2 }, 'test-request-id');
      const created3 = await handleInsertOne('users', { data: user3 }, 'test-request-id');

      // IDリストで取得
      const result = await handleFindMany(
        'users',
        {
          ids: [created1.id, created2.id, created3.id],
        },
        'test-request-id'
      );

      // 3件取得できる
      expect(result).toHaveLength(3);
      expect(result.map((item) => item.name)).toContain('Alice');
      expect(result.map((item) => item.name)).toContain('Bob');
      expect(result.map((item) => item.name)).toContain('Charlie');
    });

    it('一部のIDが存在しない場合、存在するレコードのみ返す', async () => {
      // 1件のレコードを作成
      const user1 = testDataFactory.createUser({ name: 'Alice' });
      const created1 = await handleInsertOne('users', { data: user1 }, 'test-request-id');

      // 存在するIDと存在しないIDを指定
      const result = await handleFindMany(
        'users',
        {
          ids: [created1.id, 'non-existent-id-1', 'non-existent-id-2'],
        },
        'test-request-id'
      );

      // 存在する1件のみ取得できる
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Alice');
    });
  });

  describe('異常系', () => {
    it('全てのIDが存在しない場合、空配列を返す', async () => {
      const result = await handleFindMany(
        'users',
        {
          ids: ['non-existent-id-1', 'non-existent-id-2'],
        },
        'test-request-id'
      );

      // 空配列が返される
      expect(result).toHaveLength(0);
    });

    it('IDリストが空の場合、空配列を返す', async () => {
      const result = await handleFindMany(
        'users',
        {
          ids: [],
        },
        'test-request-id'
      );

      // 空配列が返される
      expect(result).toHaveLength(0);
    });
  });
});
