/**
 * ID最適化クエリのテスト
 *
 * sort.field='id'の場合の特別な処理を検証します。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { executeIdQuery } from '../../../../src/server/operations/find/idQuery.js';
import type { NormalizedFindParams } from '../../../../src/server/operations/find/types.js';

// DynamoDB Clientのモック
vi.mock('@aws-sdk/lib-dynamodb', () => ({
  QueryCommand: vi.fn(),
  DynamoDBDocumentClient: {
    from: vi.fn(),
  },
}));

// ユーティリティのモック
vi.mock('../../../../src/server/utils/dynamodb.js', () => ({
  getDBClient: vi.fn(() => ({
    send: vi.fn(),
  })),
  getTableName: vi.fn(() => 'test-table'),
  executeDynamoDBOperation: vi.fn(async (fn) => await fn()),
  extractCleanRecord: vi.fn((item) => item.data),
}));

vi.mock('../../../../src/server/utils/pagination.js', () => ({
  decodeNextToken: vi.fn((token) => ({
    PK: 'venues',
    SK: 'id#venue-1',
  })),
  encodeNextToken: vi.fn((pk, sk) => `${pk}:${sk}`),
}));

vi.mock('../../../../src/server/operations/find/utils.js', () => ({
  matchesAllFilters: vi.fn((record, filters) => {
    // 簡易的なフィルターマッチング
    return filters.every((f: any) => {
      const value = record[f.parsed.field];
      if (f.parsed.operator === '$eq') return value === f.value;
      return true;
    });
  }),
}));

describe('idQuery', () => {
  const mockDbClient = {
    send: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const { getDBClient } = await import('../../../../src/server/utils/dynamodb.js');
    vi.mocked(getDBClient).mockReturnValue(mockDbClient as any);
  });

  describe('特定IDクエリ', () => {
    it('特定のIDのレコードを取得できる', async () => {
      mockDbClient.send.mockResolvedValueOnce({
        Items: [{ PK: 'venues', SK: 'id#venue-1', data: { id: 'venue-1', name: 'Venue1' } }],
      });

      const params: NormalizedFindParams = {
        sort: { field: 'id', order: 'ASC' },
        pagination: { perPage: 10, nextToken: undefined },
        parsedFilters: [
          {
            parsed: { field: 'id', operator: '$eq' },
            value: 'venue-1',
          },
        ],
      };

      const result = await executeIdQuery('venues', params, 'req-1');

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({ id: 'venue-1', name: 'Venue1' });
      expect(result.pageInfo.hasNextPage).toBe(false);
      expect(result.pageInfo.hasPreviousPage).toBe(false);
    });

    it('存在しないIDの場合は空配列を返す', async () => {
      mockDbClient.send.mockResolvedValueOnce({
        Items: [],
      });

      const params: NormalizedFindParams = {
        sort: { field: 'id', order: 'ASC' },
        pagination: { perPage: 10, nextToken: undefined },
        parsedFilters: [
          {
            parsed: { field: 'id', operator: '$eq' },
            value: 'non-existent',
          },
        ],
      };

      const result = await executeIdQuery('venues', params, 'req-1');

      expect(result.items).toEqual([]);
      expect(result.pageInfo.hasNextPage).toBe(false);
    });
  });

  describe('全レコードクエリ', () => {
    it('全レコードを昇順で取得できる', async () => {
      mockDbClient.send.mockResolvedValueOnce({
        Items: [
          { PK: 'venues', SK: 'id#venue-1', data: { id: 'venue-1', name: 'Venue1' } },
          { PK: 'venues', SK: 'id#venue-2', data: { id: 'venue-2', name: 'Venue2' } },
        ],
      });

      const params: NormalizedFindParams = {
        sort: { field: 'id', order: 'ASC' },
        pagination: { perPage: 10, nextToken: undefined },
        parsedFilters: [],
      };

      const result = await executeIdQuery('venues', params, 'req-1');

      expect(result.items).toHaveLength(2);
      expect(result.items[0].id).toBe('venue-1');
      expect(result.items[1].id).toBe('venue-2');
    });

    it('全レコードを降順で取得できる', async () => {
      mockDbClient.send.mockResolvedValueOnce({
        Items: [
          { PK: 'venues', SK: 'id#venue-2', data: { id: 'venue-2', name: 'Venue2' } },
          { PK: 'venues', SK: 'id#venue-1', data: { id: 'venue-1', name: 'Venue1' } },
        ],
      });

      const params: NormalizedFindParams = {
        sort: { field: 'id', order: 'DESC' },
        pagination: { perPage: 10, nextToken: undefined },
        parsedFilters: [],
      };

      const result = await executeIdQuery('venues', params, 'req-1');

      expect(result.items).toHaveLength(2);
      expect(result.items[0].id).toBe('venue-2');
      expect(result.items[1].id).toBe('venue-1');
    });

    it('フィルター条件を適用できる', async () => {
      mockDbClient.send.mockResolvedValueOnce({
        Items: [
          {
            PK: 'venues',
            SK: 'id#venue-1',
            data: { id: 'venue-1', name: 'Venue1', status: 'active' },
          },
          {
            PK: 'venues',
            SK: 'id#venue-2',
            data: { id: 'venue-2', name: 'Venue2', status: 'inactive' },
          },
        ],
      });

      const params: NormalizedFindParams = {
        sort: { field: 'id', order: 'ASC' },
        pagination: { perPage: 10, nextToken: undefined },
        parsedFilters: [
          {
            parsed: { field: 'status', operator: '$eq' },
            value: 'active',
          },
        ],
      };

      const result = await executeIdQuery('venues', params, 'req-1');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].status).toBe('active');
    });

    it('ページネーション情報を正しく生成する', async () => {
      mockDbClient.send.mockResolvedValueOnce({
        Items: [{ PK: 'venues', SK: 'id#venue-1', data: { id: 'venue-1', name: 'Venue1' } }],
        LastEvaluatedKey: { PK: 'venues', SK: 'id#venue-1' },
      });

      const params: NormalizedFindParams = {
        sort: { field: 'id', order: 'ASC' },
        pagination: { perPage: 1, nextToken: undefined },
        parsedFilters: [],
      };

      const result = await executeIdQuery('venues', params, 'req-1');

      expect(result.items).toHaveLength(1);
      expect(result.pageInfo.hasNextPage).toBe(true);
      expect(result.nextToken).toBeDefined();
    });

    it('nextTokenを使用してページング取得できる', async () => {
      mockDbClient.send.mockResolvedValueOnce({
        Items: [{ PK: 'venues', SK: 'id#venue-2', data: { id: 'venue-2', name: 'Venue2' } }],
      });

      const params: NormalizedFindParams = {
        sort: { field: 'id', order: 'ASC' },
        pagination: { perPage: 1, nextToken: 'venues:id#venue-1' },
        parsedFilters: [],
      };

      const result = await executeIdQuery('venues', params, 'req-1');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('venue-2');
      expect(result.pageInfo.hasPreviousPage).toBe(true);
    });

    it('レコードが0件の場合は空配列を返す', async () => {
      mockDbClient.send.mockResolvedValueOnce({
        Items: [],
      });

      const params: NormalizedFindParams = {
        sort: { field: 'id', order: 'ASC' },
        pagination: { perPage: 10, nextToken: undefined },
        parsedFilters: [],
      };

      const result = await executeIdQuery('venues', params, 'req-1');

      expect(result.items).toEqual([]);
      expect(result.pageInfo.hasNextPage).toBe(false);
      expect(result.pageInfo.hasPreviousPage).toBe(false);
    });

    it('perPageより少ないレコードの場合はhasNextPageがfalse', async () => {
      mockDbClient.send.mockResolvedValueOnce({
        Items: [{ PK: 'venues', SK: 'id#venue-1', data: { id: 'venue-1', name: 'Venue1' } }],
        LastEvaluatedKey: undefined,
      });

      const params: NormalizedFindParams = {
        sort: { field: 'id', order: 'ASC' },
        pagination: { perPage: 10, nextToken: undefined },
        parsedFilters: [],
      };

      const result = await executeIdQuery('venues', params, 'req-1');

      expect(result.items).toHaveLength(1);
      expect(result.pageInfo.hasNextPage).toBe(false);
    });
  });

  describe('エッジケース', () => {
    it('複数のフィルター条件を適用できる', async () => {
      mockDbClient.send.mockResolvedValueOnce({
        Items: [
          {
            PK: 'venues',
            SK: 'id#venue-1',
            data: { id: 'venue-1', name: 'Venue1', status: 'active', type: 'indoor' },
          },
          {
            PK: 'venues',
            SK: 'id#venue-2',
            data: { id: 'venue-2', name: 'Venue2', status: 'active', type: 'outdoor' },
          },
          {
            PK: 'venues',
            SK: 'id#venue-3',
            data: { id: 'venue-3', name: 'Venue3', status: 'inactive', type: 'indoor' },
          },
        ],
      });

      const params: NormalizedFindParams = {
        sort: { field: 'id', order: 'ASC' },
        pagination: { perPage: 10, nextToken: undefined },
        parsedFilters: [
          {
            parsed: { field: 'status', operator: '$eq' },
            value: 'active',
          },
          {
            parsed: { field: 'type', operator: '$eq' },
            value: 'indoor',
          },
        ],
      };

      const result = await executeIdQuery('venues', params, 'req-1');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('venue-1');
    });

    it('フィルター適用後に0件になる場合', async () => {
      mockDbClient.send.mockResolvedValueOnce({
        Items: [
          {
            PK: 'venues',
            SK: 'id#venue-1',
            data: { id: 'venue-1', name: 'Venue1', status: 'inactive' },
          },
        ],
      });

      const params: NormalizedFindParams = {
        sort: { field: 'id', order: 'ASC' },
        pagination: { perPage: 10, nextToken: undefined },
        parsedFilters: [
          {
            parsed: { field: 'status', operator: '$eq' },
            value: 'active',
          },
        ],
      };

      const result = await executeIdQuery('venues', params, 'req-1');

      expect(result.items).toEqual([]);
    });
  });
});
