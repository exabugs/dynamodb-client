/**
 * findManyReference 操作のテスト
 *
 * 参照レコード取得（外部キー指定）の動作を検証します。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleFindManyReference } from '../../../src/server/operations/findManyReference.js';
import type { FindManyReferenceParams } from '../../../src/server/types.js';

// DynamoDB Clientのモック
vi.mock('@aws-sdk/lib-dynamodb', () => ({
  BatchGetCommand: vi.fn(),
  QueryCommand: vi.fn(),
  DynamoDBDocumentClient: {
    from: vi.fn(),
  },
}));

// ユーティリティのモック
vi.mock('../../../src/server/utils/dynamodb.js', () => ({
  getDBClient: vi.fn(() => ({
    send: vi.fn(),
  })),
  getTableName: vi.fn(() => 'test-table'),
  executeDynamoDBOperation: vi.fn(async (fn) => await fn()),
  extractCleanRecord: vi.fn((item) => item.data),
}));

vi.mock('../../../src/server/shadow/index.js', () => ({
  getShadowConfig: vi.fn(() => ({
    resources: {
      venues: {
        shadows: [
          { field: 'name', type: 'string' },
          { field: 'status', type: 'string' },
        ],
      },
    },
  })),
}));

vi.mock('../../../src/server/utils/pagination.js', () => ({
  decodeNextToken: vi.fn((token) => ({
    PK: 'venues',
    SK: 'name#TestVenue#id#venue-1',
  })),
  encodeNextToken: vi.fn((pk, sk) => `${pk}:${sk}`),
}));

vi.mock('../../../src/server/utils/validation.js', () => ({
  normalizeSort: vi.fn((config, resource, sort) => sort || { field: 'name', order: 'ASC' }),
  validateSortField: vi.fn(),
  normalizePagination: vi.fn((pagination) => ({
    perPage: pagination?.perPage || 10,
    nextToken: pagination?.nextToken,
  })),
}));

describe('findManyReference', () => {
  const mockDbClient = {
    send: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const { getDBClient } = await import('../../../src/server/utils/dynamodb.js');
    vi.mocked(getDBClient).mockReturnValue(mockDbClient as any);
  });

  describe('正常系', () => {
    it('参照レコードを取得できる', async () => {
      // シャドーレコードのQueryレスポンス
      mockDbClient.send.mockResolvedValueOnce({
        Items: [
          { PK: 'venues', SK: 'name#Venue1#id#venue-1' },
          { PK: 'venues', SK: 'name#Venue2#id#venue-2' },
        ],
      });

      // 本体レコードのBatchGetレスポンス
      mockDbClient.send.mockResolvedValueOnce({
        Responses: {
          'test-table': [
            {
              PK: 'venues',
              SK: 'id#venue-1',
              data: { id: 'venue-1', name: 'Venue1', userId: 'user-1' },
            },
            {
              PK: 'venues',
              SK: 'id#venue-2',
              data: { id: 'venue-2', name: 'Venue2', userId: 'user-1' },
            },
          ],
        },
      });

      const params: FindManyReferenceParams = {
        target: 'userId',
        id: 'user-1',
        filter: {},
        sort: { field: 'name', order: 'ASC' },
        pagination: { perPage: 10 },
      };

      const result = await handleFindManyReference('venues', params, 'req-1');

      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toEqual({ id: 'venue-1', name: 'Venue1', userId: 'user-1' });
      expect(result.items[1]).toEqual({ id: 'venue-2', name: 'Venue2', userId: 'user-1' });
      expect(result.pageInfo.hasNextPage).toBe(false);
    });

    it('追加フィルターを適用できる', async () => {
      mockDbClient.send.mockResolvedValueOnce({
        Items: [
          { PK: 'venues', SK: 'name#Venue1#id#venue-1' },
          { PK: 'venues', SK: 'name#Venue2#id#venue-2' },
        ],
      });

      mockDbClient.send.mockResolvedValueOnce({
        Responses: {
          'test-table': [
            {
              PK: 'venues',
              SK: 'id#venue-1',
              data: { id: 'venue-1', name: 'Venue1', userId: 'user-1', status: 'active' },
            },
            {
              PK: 'venues',
              SK: 'id#venue-2',
              data: { id: 'venue-2', name: 'Venue2', userId: 'user-1', status: 'inactive' },
            },
          ],
        },
      });

      const params: FindManyReferenceParams = {
        target: 'userId',
        id: 'user-1',
        filter: { status: 'active' },
        sort: { field: 'name', order: 'ASC' },
        pagination: { perPage: 10 },
      };

      const result = await handleFindManyReference('venues', params, 'req-1');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].status).toBe('active');
    });

    it('ページネーション情報を正しく生成する', async () => {
      mockDbClient.send.mockResolvedValueOnce({
        Items: [{ PK: 'venues', SK: 'name#Venue1#id#venue-1' }],
        LastEvaluatedKey: { PK: 'venues', SK: 'name#Venue1#id#venue-1' },
      });

      mockDbClient.send.mockResolvedValueOnce({
        Responses: {
          'test-table': [
            {
              PK: 'venues',
              SK: 'id#venue-1',
              data: { id: 'venue-1', name: 'Venue1', userId: 'user-1' },
            },
          ],
        },
      });

      const params: FindManyReferenceParams = {
        target: 'userId',
        id: 'user-1',
        filter: {},
        sort: { field: 'name', order: 'ASC' },
        pagination: { perPage: 1 },
      };

      const result = await handleFindManyReference('venues', params, 'req-1');

      expect(result.pageInfo.hasNextPage).toBe(true);
      expect(result.nextToken).toBeDefined();
    });

    it('nextTokenを使用してページング取得できる', async () => {
      mockDbClient.send.mockResolvedValueOnce({
        Items: [{ PK: 'venues', SK: 'name#Venue2#id#venue-2' }],
      });

      mockDbClient.send.mockResolvedValueOnce({
        Responses: {
          'test-table': [
            {
              PK: 'venues',
              SK: 'id#venue-2',
              data: { id: 'venue-2', name: 'Venue2', userId: 'user-1' },
            },
          ],
        },
      });

      const params: FindManyReferenceParams = {
        target: 'userId',
        id: 'user-1',
        filter: {},
        sort: { field: 'name', order: 'ASC' },
        pagination: { perPage: 1, nextToken: 'venues:name#Venue1#id#venue-1' },
      };

      const result = await handleFindManyReference('venues', params, 'req-1');

      expect(result.items).toHaveLength(1);
      expect(result.pageInfo.hasPreviousPage).toBe(true);
    });

    it('降順ソートを適用できる', async () => {
      mockDbClient.send.mockResolvedValueOnce({
        Items: [
          { PK: 'venues', SK: 'name#Venue2#id#venue-2' },
          { PK: 'venues', SK: 'name#Venue1#id#venue-1' },
        ],
      });

      mockDbClient.send.mockResolvedValueOnce({
        Responses: {
          'test-table': [
            {
              PK: 'venues',
              SK: 'id#venue-2',
              data: { id: 'venue-2', name: 'Venue2', userId: 'user-1' },
            },
            {
              PK: 'venues',
              SK: 'id#venue-1',
              data: { id: 'venue-1', name: 'Venue1', userId: 'user-1' },
            },
          ],
        },
      });

      const params: FindManyReferenceParams = {
        target: 'userId',
        id: 'user-1',
        filter: {},
        sort: { field: 'name', order: 'DESC' },
        pagination: { perPage: 10 },
      };

      const result = await handleFindManyReference('venues', params, 'req-1');

      expect(result.items).toHaveLength(2);
      expect(result.items[0].name).toBe('Venue2');
      expect(result.items[1].name).toBe('Venue1');
    });
  });

  describe('エッジケース', () => {
    it('シャドーレコードが0件の場合は空配列を返す', async () => {
      mockDbClient.send.mockResolvedValueOnce({
        Items: [],
      });

      const params: FindManyReferenceParams = {
        target: 'userId',
        id: 'user-1',
        filter: {},
        sort: { field: 'name', order: 'ASC' },
        pagination: { perPage: 10 },
      };

      const result = await handleFindManyReference('venues', params, 'req-1');

      expect(result.items).toEqual([]);
      expect(result.pageInfo.hasNextPage).toBe(false);
      expect(result.pageInfo.hasPreviousPage).toBe(false);
    });

    it('target/idフィルターに一致しないレコードを除外する', async () => {
      mockDbClient.send.mockResolvedValueOnce({
        Items: [
          { PK: 'venues', SK: 'name#Venue1#id#venue-1' },
          { PK: 'venues', SK: 'name#Venue2#id#venue-2' },
        ],
      });

      mockDbClient.send.mockResolvedValueOnce({
        Responses: {
          'test-table': [
            {
              PK: 'venues',
              SK: 'id#venue-1',
              data: { id: 'venue-1', name: 'Venue1', userId: 'user-1' },
            },
            {
              PK: 'venues',
              SK: 'id#venue-2',
              data: { id: 'venue-2', name: 'Venue2', userId: 'user-2' },
            },
          ],
        },
      });

      const params: FindManyReferenceParams = {
        target: 'userId',
        id: 'user-1',
        filter: {},
        sort: { field: 'name', order: 'ASC' },
        pagination: { perPage: 10 },
      };

      const result = await handleFindManyReference('venues', params, 'req-1');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].userId).toBe('user-1');
    });

    it('本体レコードが見つからない場合は除外する', async () => {
      mockDbClient.send.mockResolvedValueOnce({
        Items: [
          { PK: 'venues', SK: 'name#Venue1#id#venue-1' },
          { PK: 'venues', SK: 'name#Venue2#id#venue-2' },
        ],
      });

      mockDbClient.send.mockResolvedValueOnce({
        Responses: {
          'test-table': [
            {
              PK: 'venues',
              SK: 'id#venue-1',
              data: { id: 'venue-1', name: 'Venue1', userId: 'user-1' },
            },
            // venue-2は存在しない
          ],
        },
      });

      const params: FindManyReferenceParams = {
        target: 'userId',
        id: 'user-1',
        filter: {},
        sort: { field: 'name', order: 'ASC' },
        pagination: { perPage: 10 },
      };

      const result = await handleFindManyReference('venues', params, 'req-1');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('venue-1');
    });

    it('複数の追加フィルターを適用できる', async () => {
      mockDbClient.send.mockResolvedValueOnce({
        Items: [
          { PK: 'venues', SK: 'name#Venue1#id#venue-1' },
          { PK: 'venues', SK: 'name#Venue2#id#venue-2' },
          { PK: 'venues', SK: 'name#Venue3#id#venue-3' },
        ],
      });

      mockDbClient.send.mockResolvedValueOnce({
        Responses: {
          'test-table': [
            {
              PK: 'venues',
              SK: 'id#venue-1',
              data: {
                id: 'venue-1',
                name: 'Venue1',
                userId: 'user-1',
                status: 'active',
                type: 'indoor',
              },
            },
            {
              PK: 'venues',
              SK: 'id#venue-2',
              data: {
                id: 'venue-2',
                name: 'Venue2',
                userId: 'user-1',
                status: 'active',
                type: 'outdoor',
              },
            },
            {
              PK: 'venues',
              SK: 'id#venue-3',
              data: {
                id: 'venue-3',
                name: 'Venue3',
                userId: 'user-1',
                status: 'inactive',
                type: 'indoor',
              },
            },
          ],
        },
      });

      const params: FindManyReferenceParams = {
        target: 'userId',
        id: 'user-1',
        filter: { status: 'active', type: 'indoor' },
        sort: { field: 'name', order: 'ASC' },
        pagination: { perPage: 10 },
      };

      const result = await handleFindManyReference('venues', params, 'req-1');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('venue-1');
    });
  });
});
