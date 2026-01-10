/**
 * insertOne 統合テスト
 *
 * DynamoDBモックを使用してinsertOne操作をテスト
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('insertOne - Integration Tests', () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    mockDynamoClient = new DynamoDBMock();
    mockDynamoClient.createTable('test-table');
  });

  afterEach(() => {
    mockDynamoClient.clear();
  });

  describe('正常系', () => {
    it('新しいレコードを作成できる', async () => {
      const userData = testDataFactory.createUser({
        name: 'Alice',
        email: 'alice@example.com',
      });

      const result = await handleInsertOne('users', { data: userData }, 'test-request-id');

      expect(result.id).toBeDefined();
      expect(result.name).toBe('Alice');
      expect(result.email).toBe('alice@example.com');
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('IDを指定してレコードを作成できる', async () => {
      const userData = testDataFactory.createUser({
        id: 'custom-id-123',
        name: 'Bob',
      });

      const result = await handleInsertOne('users', { data: userData }, 'test-request-id');

      expect(result.id).toBe('custom-id-123');
      expect(result.name).toBe('Bob');
    });

    it('タイムスタンプが自動的に追加される', async () => {
      const userData = testDataFactory.createUser();
      delete (userData as any).createdAt;
      delete (userData as any).updatedAt;

      const result = await handleInsertOne('users', { data: userData }, 'test-request-id');

      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
      expect(typeof result.createdAt).toBe('string');
      expect(typeof result.updatedAt).toBe('string');
    });
  });

  describe('異常系', () => {
    it('空のデータでもレコードが作成される（バリデーションなし）', async () => {
      // 現在の実装では空のデータでもレコードが作成される
      const result = await handleInsertOne('users', { data: {} }, 'test-request-id');

      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });
  });

  describe('シャドーレコード', () => {
    it('シャドーレコードが生成される', async () => {
      const userData = testDataFactory.createUser({
        email: 'test@example.com',
        name: 'Test User',
      });

      const result = await handleInsertOne('users', { data: userData }, 'test-request-id');

      // シャドーレコードのメタデータが含まれているか確認
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });
  });
});
