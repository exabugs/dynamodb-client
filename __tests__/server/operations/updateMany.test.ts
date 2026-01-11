/**
 * updateMany サーバー側ユニットテスト
 *
 * 要件: 2.1, 2.2
 *
 * このテストは、サーバー側の updateMany 実装を直接テストします。
 * クライアント側のモックテストとは異なり、実際の実装をテストします。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { UpdateManyParams, UpdateManyResult } from '../../../src/server/types.js';

// DynamoDBクライアントをモック
vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({
      send: vi.fn(),
    })),
  },
  BatchGetCommand: vi.fn(),
  TransactWriteCommand: vi.fn(),
}));

// 環境変数をモック
process.env.DYNAMODB_TABLE_NAME = 'test-table';
process.env.SHADOW_CONFIG = JSON.stringify({
  users: {
    email: { type: 'string' },
    status: { type: 'string' },
  },
});

describe('updateMany server operation', () => {
  let mockSend: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules(); // モジュールをリセット

    // DynamoDBクライアントのsendメソッドをモック
    mockSend = vi.fn();

    vi.doMock('@aws-sdk/lib-dynamodb', () => ({
      DynamoDBDocumentClient: {
        from: vi.fn(() => ({
          send: mockSend,
        })),
      },
      BatchGetCommand: vi.fn((params) => params),
      TransactWriteCommand: vi.fn((params) => params),
    }));

    // getDBClientをモック
    vi.doMock('../../../src/server/utils/dynamodb.js', () => ({
      getDBClient: () => ({
        send: mockSend,
      }),
      getTableName: () => 'test-table',
      executeDynamoDBOperation: async (fn: () => Promise<any>) => fn(),
      removeShadowKeys: (data: Record<string, unknown>) => {
        const { __shadowKeys, ...rest } = data;
        return rest;
      },
    }));

    // タイムスタンプヘルパーをモック
    vi.doMock('../../../src/server/utils/timestamps.js', () => ({
      addUpdateTimestamp: (data: Record<string, unknown>) => ({
        ...data,
        updatedAt: '2024-01-02T00:00:00Z',
      }),
      addCreateTimestamp: (data: Record<string, unknown>) => ({
        ...data,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }),
      addCreateTimestamps: (data: Record<string, unknown>) => ({
        ...data,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }),
    }));

    // シャドーヘルパーをモック
    vi.doMock('../../../src/server/shadow/index.js', () => ({
      getShadowConfig: () => ({
        users: {
          email: { type: 'string' },
          status: { type: 'string' },
        },
      }),
      generateShadowRecords: () => [],
      calculateShadowDiff: () => ({ toAdd: [], toDelete: [] }),
      generateMainRecordSK: (id: string) => `MAIN#${id}`,
    }));
  });

  describe('基本的な更新', () => {
    it('既存レコードを更新できる', async () => {
      // BatchGetCommandのレスポンスをモック（既存レコード）
      mockSend
        .mockResolvedValueOnce({
          Responses: {
            'test-table': [
              {
                PK: 'users',
                SK: 'MAIN#user-1',
                data: {
                  id: 'user-1',
                  name: 'Alice',
                  email: 'alice@example.com',
                  status: 'active',
                  createdAt: '2024-01-01T00:00:00Z',
                  updatedAt: '2024-01-01T00:00:00Z',
                  __shadowKeys: [],
                },
              },
            ],
          },
        })
        // TransactWriteCommandのレスポンスをモック
        .mockResolvedValueOnce({});

      const { handleUpdateMany } = await import('../../../src/server/operations/updateMany.js');

      const params: UpdateManyParams = {
        ids: ['user-1'],
        data: {
          name: 'Alice Updated',
        },
      };

      const result: UpdateManyResult = await handleUpdateMany('users', params, 'test-request-id');

      expect(result.count).toBe(1);
      expect(result.successIds).toEqual({ 0: 'user-1' });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        id: 'user-1',
        name: 'Alice Updated',
      });
    });

    it('複数レコードを更新できる', async () => {
      // BatchGetCommandのレスポンスをモック
      mockSend
        .mockResolvedValueOnce({
          Responses: {
            'test-table': [
              {
                PK: 'users',
                SK: 'MAIN#user-1',
                data: {
                  id: 'user-1',
                  name: 'Alice',
                  email: 'alice@example.com',
                  __shadowKeys: [],
                },
              },
              {
                PK: 'users',
                SK: 'MAIN#user-2',
                data: {
                  id: 'user-2',
                  name: 'Bob',
                  email: 'bob@example.com',
                  __shadowKeys: [],
                },
              },
            ],
          },
        })
        // TransactWriteCommandのレスポンスをモック
        .mockResolvedValueOnce({});

      const { handleUpdateMany } = await import('../../../src/server/operations/updateMany.js');

      const params: UpdateManyParams = {
        ids: ['user-1', 'user-2'],
        data: {
          status: 'inactive',
        },
      };

      const result = await handleUpdateMany('users', params, 'test-request-id');

      expect(result.count).toBe(2);
      expect(result.successIds).toEqual({ 0: 'user-1', 1: 'user-2' });
    });
  });

  describe('upsert: false（デフォルト）', () => {
    it('存在しないレコードでエラーになる', async () => {
      // BatchGetCommandのレスポンスをモック（レコードなし）
      mockSend.mockResolvedValueOnce({
        Responses: {
          'test-table': [],
        },
      });

      const { handleUpdateMany } = await import('../../../src/server/operations/updateMany.js');

      const params: UpdateManyParams = {
        ids: ['user-999'],
        data: {
          name: 'Not Found User',
        },
        options: {
          upsert: false,
        },
      };

      const result = await handleUpdateMany('users', params, 'test-request-id');

      expect(result.count).toBe(0);
      expect(result.failedIds).toEqual({ 0: 'user-999' });
      expect(result.errors).toMatchObject({
        0: {
          id: 'user-999',
          code: 'ITEM_NOT_FOUND',
          message: expect.stringContaining('Record not found'),
        },
      });
    });
  });

  describe('upsert: true（insert case）', () => {
    it('存在しないレコードを新規作成できる', async () => {
      // BatchGetCommandのレスポンスをモック（レコードなし）
      mockSend
        .mockResolvedValueOnce({
          Responses: {
            'test-table': [],
          },
        })
        // TransactWriteCommandのレスポンスをモック
        .mockResolvedValueOnce({});

      const { handleUpdateMany } = await import('../../../src/server/operations/updateMany.js');

      const params: UpdateManyParams = {
        ids: ['user-new'],
        data: {
          $set: {
            name: 'New User',
            email: 'new@example.com',
          },
          $setOnInsert: {
            status: 'active',
          },
        },
        options: {
          upsert: true,
        },
      };

      const result = await handleUpdateMany('users', params, 'test-request-id');

      expect(result.count).toBe(1);
      expect(result.successIds).toEqual({ 0: 'user-new' });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        id: 'user-new',
        name: 'New User',
        email: 'new@example.com',
      });
    });

    it('$setが$setOnInsertより優先される', async () => {
      // BatchGetCommandのレスポンスをモック（レコードなし）
      mockSend
        .mockResolvedValueOnce({
          Responses: {
            'test-table': [],
          },
        })
        // TransactWriteCommandのレスポンスをモック
        .mockResolvedValueOnce({});

      const { handleUpdateMany } = await import('../../../src/server/operations/updateMany.js');

      const params: UpdateManyParams = {
        ids: ['user-new'],
        data: {
          $set: {
            status: 'pending', // $setが優先される
          },
          $setOnInsert: {
            status: 'active', // 無視される
          },
        },
        options: {
          upsert: true,
        },
      };

      const result = await handleUpdateMany('users', params, 'test-request-id');

      expect(result.count).toBe(1);
      // $setの値が適用されることを確認
      expect(result.items[0]).toMatchObject({
        id: 'user-new',
        status: 'pending',
      });
    });

    it('$setOnInsertのみでも新規作成できる', async () => {
      // BatchGetCommandのレスポンスをモック（レコードなし）
      mockSend
        .mockResolvedValueOnce({
          Responses: {
            'test-table': [],
          },
        })
        // TransactWriteCommandのレスポンスをモック
        .mockResolvedValueOnce({});

      const { handleUpdateMany } = await import('../../../src/server/operations/updateMany.js');

      const params: UpdateManyParams = {
        ids: ['user-new'],
        data: {
          $setOnInsert: {
            name: 'New User',
            email: 'new@example.com',
            status: 'active',
          },
        },
        options: {
          upsert: true,
        },
      };

      const result = await handleUpdateMany('users', params, 'test-request-id');

      expect(result.count).toBe(1);
      expect(result.items[0]).toMatchObject({
        id: 'user-new',
        name: 'New User',
        email: 'new@example.com',
        status: 'active',
      });
    });
  });

  describe('upsert: true（update case）', () => {
    it('既存レコードを更新し、$setOnInsertを無視する', async () => {
      // BatchGetCommandのレスポンスをモック（既存レコード）
      mockSend
        .mockResolvedValueOnce({
          Responses: {
            'test-table': [
              {
                PK: 'users',
                SK: 'MAIN#user-1',
                data: {
                  id: 'user-1',
                  name: 'Alice',
                  email: 'alice@example.com',
                  status: 'active',
                  createdAt: '2024-01-01T00:00:00Z',
                  __shadowKeys: [],
                },
              },
            ],
          },
        })
        // TransactWriteCommandのレスポンスをモック
        .mockResolvedValueOnce({});

      const { handleUpdateMany } = await import('../../../src/server/operations/updateMany.js');

      const params: UpdateManyParams = {
        ids: ['user-1'],
        data: {
          $set: {
            email: 'alice.new@example.com',
          },
          $setOnInsert: {
            status: 'pending', // 無視される
          },
        },
        options: {
          upsert: true,
        },
      };

      const result = await handleUpdateMany('users', params, 'test-request-id');

      expect(result.count).toBe(1);
      expect(result.items[0]).toMatchObject({
        id: 'user-1',
        email: 'alice.new@example.com',
      });
      // statusは更新されない（$setOnInsertは無視される）
      expect(result.items[0]).not.toHaveProperty('status');
    });
  });

  describe('upsert: true（混在ケース）', () => {
    it('一部が新規作成、一部が更新される', async () => {
      // BatchGetCommandのレスポンスをモック（user-1のみ存在）
      mockSend
        .mockResolvedValueOnce({
          Responses: {
            'test-table': [
              {
                PK: 'users',
                SK: 'MAIN#user-1',
                data: {
                  id: 'user-1',
                  name: 'Alice',
                  email: 'alice@example.com',
                  __shadowKeys: [],
                },
              },
            ],
          },
        })
        // TransactWriteCommandのレスポンスをモック
        .mockResolvedValueOnce({});

      const { handleUpdateMany } = await import('../../../src/server/operations/updateMany.js');

      const params: UpdateManyParams = {
        ids: ['user-1', 'user-new'],
        data: {
          $set: {
            status: 'active',
          },
          $setOnInsert: {
            name: 'Default Name',
          },
        },
        options: {
          upsert: true,
        },
      };

      const result = await handleUpdateMany('users', params, 'test-request-id');

      expect(result.count).toBe(2);
      expect(result.successIds).toEqual({ 0: 'user-1', 1: 'user-new' });
      expect(result.items).toHaveLength(2);

      // user-1は更新（$setOnInsertは無視）
      expect(result.items[0]).toMatchObject({
        id: 'user-1',
        status: 'active',
      });

      // user-newは新規作成（$setと$setOnInsertが適用）
      expect(result.items[1]).toMatchObject({
        id: 'user-new',
        status: 'active',
        name: 'Default Name',
      });
    });
  });
});
