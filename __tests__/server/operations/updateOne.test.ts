/**
 * updateOne サーバー側ユニットテスト
 *
 * 要件: 2.1, 2.2
 *
 * このテストは、サーバー側の updateOne 実装を直接テストします。
 * クライアント側のモックテストとは異なり、実際の実装をテストします。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { UpdateOneParams, UpdateOneResult } from '../../../src/server/types.js';

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

describe('updateOne server operation', () => {
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

  describe('id版 - 基本的な更新', () => {
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

      const { handleUpdateOne } = await import('../../../src/server/operations/updateOne.js');

      const params: UpdateOneParams = {
        id: 'user-1',
        data: {
          name: 'Alice Updated',
        },
      };

      const result: UpdateOneResult = await handleUpdateOne('users', params, 'test-request-id');

      expect(result).toMatchObject({
        id: 'user-1',
        name: 'Alice Updated',
      });
    });

    it('存在しないレコードでエラーになる（upsert: false）', async () => {
      // BatchGetCommandのレスポンスをモック（レコードなし）
      mockSend.mockResolvedValueOnce({
        Responses: {
          'test-table': [],
        },
      });

      const { handleUpdateOne } = await import('../../../src/server/operations/updateOne.js');

      const params: UpdateOneParams = {
        id: 'user-999',
        data: {
          name: 'Not Found User',
        },
        options: {
          upsert: false,
        },
      };

      await expect(handleUpdateOne('users', params, 'test-request-id')).rejects.toThrow(
        /Failed to update record/
      );
    });
  });

  describe('filter版 - 基本的な更新', () => {
    it('既存レコードを更新できる', async () => {
      // findの結果をモック（handleFindが呼ばれる）
      vi.doMock('../../../src/server/operations/find.js', () => ({
        handleFind: vi.fn().mockResolvedValue({
          items: [{ id: 'user-1' }],
        }),
      }));

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
                  __shadowKeys: [],
                },
              },
            ],
          },
        })
        // TransactWriteCommandのレスポンスをモック
        .mockResolvedValueOnce({});

      const { handleUpdateOne } = await import('../../../src/server/operations/updateOne.js');

      const params: UpdateOneParams = {
        filter: { email: 'alice@example.com' },
        data: {
          name: 'Alice Updated',
        },
      };

      const result = await handleUpdateOne('users', params, 'test-request-id');

      expect(result).toMatchObject({
        id: 'user-1',
        name: 'Alice Updated',
      });
    });

    it('存在しないレコードでエラーになる（upsert: false）', async () => {
      // findの結果をモック（レコードなし）
      vi.doMock('../../../src/server/operations/find.js', () => ({
        handleFind: vi.fn().mockResolvedValue({
          items: [],
        }),
      }));

      // BatchGetCommandのレスポンスをモック（レコードなし）
      mockSend.mockResolvedValueOnce({
        Responses: {
          'test-table': [],
        },
      });

      const { handleUpdateOne } = await import('../../../src/server/operations/updateOne.js');

      const params: UpdateOneParams = {
        filter: { email: 'notfound@example.com' },
        data: {
          name: 'Not Found User',
        },
        options: {
          upsert: false,
        },
      };

      await expect(handleUpdateOne('users', params, 'test-request-id')).rejects.toThrow(
        /No records found matching filter/
      );
    });
  });

  describe('filter版 - upsert: true（insert case）', () => {
    it('存在しないレコードを新規作成できる', async () => {
      // findの結果をモック（レコードなし）
      vi.doMock('../../../src/server/operations/find.js', () => ({
        handleFind: vi.fn().mockResolvedValue({
          items: [],
        }),
      }));

      // BatchGetCommandのレスポンスをモック（レコードなし）
      mockSend
        .mockResolvedValueOnce({
          Responses: {
            'test-table': [],
          },
        })
        // TransactWriteCommandのレスポンスをモック
        .mockResolvedValueOnce({});

      const { handleUpdateOne } = await import('../../../src/server/operations/updateOne.js');

      const params: UpdateOneParams = {
        filter: { token: 'new-token-123' },
        data: {
          $set: {
            userId: 'user-1',
            platform: 'ios',
          },
          $setOnInsert: {
            status: 'active',
          },
        },
        options: {
          upsert: true,
        },
      };

      const result = await handleUpdateOne('users', params, 'test-request-id');

      expect(result).toMatchObject({
        userId: 'user-1',
        platform: 'ios',
        status: 'active',
      });
    });

    it('$setが$setOnInsertより優先される', async () => {
      // findの結果をモック（レコードなし）
      vi.doMock('../../../src/server/operations/find.js', () => ({
        handleFind: vi.fn().mockResolvedValue({
          items: [],
        }),
      }));

      // BatchGetCommandのレスポンスをモック（レコードなし）
      mockSend
        .mockResolvedValueOnce({
          Responses: {
            'test-table': [],
          },
        })
        // TransactWriteCommandのレスポンスをモック
        .mockResolvedValueOnce({});

      const { handleUpdateOne } = await import('../../../src/server/operations/updateOne.js');

      const params: UpdateOneParams = {
        filter: { token: 'new-token-123' },
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

      const result = await handleUpdateOne('users', params, 'test-request-id');

      // $setの値が適用されることを確認
      expect(result).toMatchObject({
        status: 'pending',
      });
    });

    it('$setOnInsertのみでも新規作成できる', async () => {
      // findの結果をモック（レコードなし）
      vi.doMock('../../../src/server/operations/find.js', () => ({
        handleFind: vi.fn().mockResolvedValue({
          items: [],
        }),
      }));

      // BatchGetCommandのレスポンスをモック（レコードなし）
      mockSend
        .mockResolvedValueOnce({
          Responses: {
            'test-table': [],
          },
        })
        // TransactWriteCommandのレスポンスをモック
        .mockResolvedValueOnce({});

      const { handleUpdateOne } = await import('../../../src/server/operations/updateOne.js');

      const params: UpdateOneParams = {
        filter: { token: 'new-token-123' },
        data: {
          $setOnInsert: {
            userId: 'user-1',
            platform: 'ios',
            status: 'active',
          },
        },
        options: {
          upsert: true,
        },
      };

      const result = await handleUpdateOne('users', params, 'test-request-id');

      expect(result).toMatchObject({
        userId: 'user-1',
        platform: 'ios',
        status: 'active',
      });
    });
  });

  describe('filter版 - upsert: true（update case）', () => {
    it('既存レコードを更新し、$setOnInsertを無視する', async () => {
      // findの結果をモック（レコードあり）
      vi.doMock('../../../src/server/operations/find.js', () => ({
        handleFind: vi.fn().mockResolvedValue({
          items: [{ id: 'user-1' }],
        }),
      }));

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
                  userId: 'user-1',
                  token: 'existing-token',
                  platform: 'ios',
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

      const { handleUpdateOne } = await import('../../../src/server/operations/updateOne.js');

      const params: UpdateOneParams = {
        filter: { token: 'existing-token' },
        data: {
          $set: {
            platform: 'android',
          },
          $setOnInsert: {
            status: 'pending', // 無視される
          },
        },
        options: {
          upsert: true,
        },
      };

      const result = await handleUpdateOne('users', params, 'test-request-id');

      expect(result).toMatchObject({
        id: 'user-1',
        platform: 'android',
      });
      // statusは更新されない（$setOnInsertは無視される）
      expect(result).not.toHaveProperty('status');
    });
  });
});
