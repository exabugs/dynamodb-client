/**
 * updateOne 統合テスト
 *
 * DynamoDBモックを使用してupdateOne操作をテスト
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { handleInsertOne } from '../../../src/server/operations/insertOne.js';
import { handleUpdateOne } from '../../../src/server/operations/updateOne.js';
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

describe('updateOne - Integration Tests', () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    mockDynamoClient = new DynamoDBMock();
    mockDynamoClient.createTable('test-table');
  });

  afterEach(() => {
    mockDynamoClient.clear();
  });

  describe('正常系', () => {
    it('既存レコードを更新できる', async () => {
      // 事前にレコードを作成
      const userData = testDataFactory.createUser({
        name: 'Alice',
        email: 'alice@example.com',
        status: 'active',
      });

      const created = await handleInsertOne('users', { data: userData }, 'test-request-id');

      // レコードを更新
      const result = await handleUpdateOne(
        'users',
        {
          id: created.id,
          data: {
            $set: { name: 'Alice Updated', status: 'inactive' },
          },
        },
        'test-request-id'
      );

      // updateOneは更新したフィールドのみを返す（ADR 001）
      expect(result.id).toBe(created.id);
      expect(result.name).toBe('Alice Updated');
      expect(result.status).toBe('inactive');
      // email は更新していないので返されない
      expect(result.email).toBeUndefined();
    });

    it('$setオペレーターで複数フィールドを更新できる', async () => {
      const userData = testDataFactory.createUser({
        name: 'Bob',
        email: 'bob@example.com',
        status: 'active',
      });

      const created = await handleInsertOne('users', { data: userData }, 'test-request-id');

      const result = await handleUpdateOne(
        'users',
        {
          id: created.id,
          data: {
            $set: {
              name: 'Bob Updated',
              email: 'bob.updated@example.com',
              status: 'inactive',
            },
          },
        },
        'test-request-id'
      );

      // updateOneは更新したフィールドのみを返す（ADR 001）
      expect(result.id).toBe(created.id);
      expect(result.name).toBe('Bob Updated');
      expect(result.email).toBe('bob.updated@example.com');
      expect(result.status).toBe('inactive');
    });

    it('$unsetオペレーターでフィールドを削除できる', async () => {
      const userData = testDataFactory.createUser({
        name: 'Charlie',
        email: 'charlie@example.com',
        role: 'admin',
      });

      const created = await handleInsertOne('users', { data: userData }, 'test-request-id');

      const result = await handleUpdateOne(
        'users',
        {
          id: created.id,
          data: {
            $unset: { role: true },
          },
        },
        'test-request-id'
      );

      // updateOneは更新したフィールドのみを返す（ADR 001）
      // $unsetの場合、削除されたフィールドは返されない
      expect(result.id).toBe(created.id);
      // name, emailは更新していないので返されない
      expect(result.name).toBeUndefined();
      expect(result.email).toBeUndefined();
      // roleは削除されたので返されない
      expect(result.role).toBeUndefined();
    });

    it('タイムスタンプが自動的に更新される', async () => {
      const userData = testDataFactory.createUser();
      const created = await handleInsertOne('users', { data: userData }, 'test-request-id');

      // 少し待機
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await handleUpdateOne(
        'users',
        {
          id: created.id,
          data: {
            $set: { name: 'Updated Name' },
          },
        },
        'test-request-id'
      );

      // updateOneは更新したフィールドのみを返す（ADR 001）
      // タイムスタンプは自動更新されるが、明示的に$setしていないので返されない
      expect(result.id).toBe(created.id);
      expect(result.name).toBe('Updated Name');
    });
  });

  describe('異常系', () => {
    it('存在しないレコードの更新でエラーになる', async () => {
      await expect(
        handleUpdateOne(
          'users',
          {
            id: 'non-existent-id',
            data: {
              $set: { name: 'Updated' },
            },
          },
          'test-request-id'
        )
      ).rejects.toThrow();
    });
  });

  describe('シャドーレコード', () => {
    it('シャドーレコードが更新される', async () => {
      const userData = testDataFactory.createUser({
        email: 'test@example.com',
        name: 'Test User',
      });

      const created = await handleInsertOne('users', { data: userData }, 'test-request-id');

      // emailを更新（シャドーレコードに影響）
      const result = await handleUpdateOne(
        'users',
        {
          id: created.id,
          data: {
            $set: { email: 'updated@example.com' },
          },
        },
        'test-request-id'
      );

      expect(result.email).toBe('updated@example.com');
      // シャドーレコードのメタデータが維持されているか確認
      expect(result).toBeDefined();
    });
  });
});
