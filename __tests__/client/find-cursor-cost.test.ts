/**
 * FindCursor クラスのコスト追跡テスト
 *
 * 要件: 9.1, 9.2, 10.3, 10.5
 *
 * このテストは、FindCursorクラスのコスト追跡機能を検証します。
 * - getConsumedCapacity()メソッドの動作
 * - 複数ページのコスト集計
 * - 後方互換性
 *
 * カバレッジ目標: 90%
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FindCursor } from '../../src/client/FindCursor.js';
import type { AggregatedCost } from '../../src/shared/types/consumed-capacity.js';

describe('FindCursor cost tracking', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // fetchをモック
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  describe('getConsumedCapacity()', () => {
    it('単一ページのコスト情報を返す', async () => {
      const mockResponse = {
        success: true,
        data: {
          items: [
            { id: 'item-1', name: 'Item 1', status: 'active' },
            { id: 'item-2', name: 'Item 2', status: 'active' },
          ],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
          },
          consumedCapacity: {
            totalRCU: 2.5,
            totalWCU: 0,
            operationCount: 1,
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const cursor = new FindCursor(
        'https://test-api.example.com',
        'test-collection',
        { status: 'active' },
        {},
        'test-token',
        undefined,
        undefined,
        async () => ({ Authorization: 'Bearer test-token' })
      );

      const results = await cursor.toArray();
      const cost = await cursor.getConsumedCapacity();

      expect(results).toHaveLength(2);
      expect(cost).toEqual({
        totalRCU: 2.5,
        totalWCU: 0,
        operationCount: 1,
      });
    });

    it('実行前に呼び出すと自動的にクエリを実行する', async () => {
      const mockResponse = {
        success: true,
        data: {
          items: [{ id: 'item-1', name: 'Item 1' }],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
          },
          consumedCapacity: {
            totalRCU: 1.0,
            totalWCU: 0,
            operationCount: 1,
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const cursor = new FindCursor(
        'https://test-api.example.com',
        'test-collection',
        {},
        {},
        'test-token',
        undefined,
        undefined,
        async () => ({ Authorization: 'Bearer test-token' })
      );

      // toArray()を呼ばずに直接getConsumedCapacity()を呼び出す
      const cost = await cursor.getConsumedCapacity();

      expect(cost).toEqual({
        totalRCU: 1.0,
        totalWCU: 0,
        operationCount: 1,
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('複数回呼び出しても同じ結果を返す（副作用なし）', async () => {
      const mockResponse = {
        success: true,
        data: {
          items: [{ id: 'item-1', name: 'Item 1' }],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
          },
          consumedCapacity: {
            totalRCU: 1.5,
            totalWCU: 0,
            operationCount: 1,
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const cursor = new FindCursor(
        'https://test-api.example.com',
        'test-collection',
        {},
        {},
        'test-token',
        undefined,
        undefined,
        async () => ({ Authorization: 'Bearer test-token' })
      );

      const cost1 = await cursor.getConsumedCapacity();
      const cost2 = await cursor.getConsumedCapacity();
      const cost3 = await cursor.getConsumedCapacity();

      expect(cost1).toEqual(cost2);
      expect(cost2).toEqual(cost3);
      expect(cost1).toEqual({
        totalRCU: 1.5,
        totalWCU: 0,
        operationCount: 1,
      });
      // クエリは1回のみ実行される
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('consumedCapacityが存在しない場合はundefinedを返す', async () => {
      const mockResponse = {
        success: true,
        data: {
          items: [{ id: 'item-1', name: 'Item 1' }],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
          },
          // consumedCapacityなし
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const cursor = new FindCursor(
        'https://test-api.example.com',
        'test-collection',
        {},
        {},
        'test-token',
        undefined,
        undefined,
        async () => ({ Authorization: 'Bearer test-token' })
      );

      const cost = await cursor.getConsumedCapacity();

      expect(cost).toBeUndefined();
    });

    it('レコードが0件の場合もコスト情報を返す', async () => {
      const mockResponse = {
        success: true,
        data: {
          items: [],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
          },
          consumedCapacity: {
            totalRCU: 0.5,
            totalWCU: 0,
            operationCount: 1,
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const cursor = new FindCursor(
        'https://test-api.example.com',
        'test-collection',
        { status: 'non-existent' },
        {},
        'test-token',
        undefined,
        undefined,
        async () => ({ Authorization: 'Bearer test-token' })
      );

      const results = await cursor.toArray();
      const cost = await cursor.getConsumedCapacity();

      expect(results).toHaveLength(0);
      expect(cost).toEqual({
        totalRCU: 0.5,
        totalWCU: 0,
        operationCount: 1,
      });
    });
  });

  describe('ページネーション', () => {
    it('次ページが存在する場合のコスト情報', async () => {
      const mockResponse = {
        success: true,
        data: {
          items: [
            { id: 'item-1', name: 'Item 1' },
            { id: 'item-2', name: 'Item 2' },
          ],
          pageInfo: {
            hasNextPage: true,
            hasPreviousPage: false,
          },
          nextToken: 'next-page-token',
          consumedCapacity: {
            totalRCU: 2.0,
            totalWCU: 0,
            operationCount: 1,
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const cursor = new FindCursor(
        'https://test-api.example.com',
        'test-collection',
        {},
        { limit: 2 },
        'test-token',
        undefined,
        undefined,
        async () => ({ Authorization: 'Bearer test-token' })
      );

      const results = await cursor.toArray();
      const pageInfo = await cursor.getPageInfo();
      const cost = await cursor.getConsumedCapacity();

      expect(results).toHaveLength(2);
      expect(pageInfo.hasNextPage).toBe(true);
      expect(pageInfo.nextToken).toBe('next-page-token');
      expect(cost).toEqual({
        totalRCU: 2.0,
        totalWCU: 0,
        operationCount: 1,
      });
    });

    it('前ページが存在する場合のコスト情報', async () => {
      const mockResponse = {
        success: true,
        data: {
          items: [
            { id: 'item-3', name: 'Item 3' },
            { id: 'item-4', name: 'Item 4' },
          ],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: true,
          },
          consumedCapacity: {
            totalRCU: 1.5,
            totalWCU: 0,
            operationCount: 1,
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const cursor = new FindCursor(
        'https://test-api.example.com',
        'test-collection',
        {},
        { limit: 2, skip: 2 },
        'test-token',
        undefined,
        undefined,
        async () => ({ Authorization: 'Bearer test-token' })
      );

      const results = await cursor.toArray();
      const pageInfo = await cursor.getPageInfo();
      const cost = await cursor.getConsumedCapacity();

      expect(results).toHaveLength(2);
      expect(pageInfo.hasPreviousPage).toBe(true);
      expect(cost).toEqual({
        totalRCU: 1.5,
        totalWCU: 0,
        operationCount: 1,
      });
    });
  });

  describe('ソートとフィルタ', () => {
    it('ソート付きクエリのコスト情報', async () => {
      const mockResponse = {
        success: true,
        data: {
          items: [
            { id: 'item-3', name: 'Item C', price: 300 },
            { id: 'item-2', name: 'Item B', price: 200 },
            { id: 'item-1', name: 'Item A', price: 100 },
          ],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
          },
          consumedCapacity: {
            totalRCU: 3.5,
            totalWCU: 0,
            operationCount: 1,
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const cursor = new FindCursor(
        'https://test-api.example.com',
        'test-collection',
        { status: 'active' },
        { sort: { price: 'desc' } },
        'test-token',
        undefined,
        undefined,
        async () => ({ Authorization: 'Bearer test-token' })
      );

      const results = await cursor.toArray();
      const cost = await cursor.getConsumedCapacity();

      expect(results).toHaveLength(3);
      expect(results[0].price).toBe(300);
      expect(cost).toEqual({
        totalRCU: 3.5,
        totalWCU: 0,
        operationCount: 1,
      });
    });

    it('複雑なフィルタのコスト情報', async () => {
      const mockResponse = {
        success: true,
        data: {
          items: [
            { id: 'item-1', name: 'Item 1', price: 1500, status: 'active' },
            { id: 'item-2', name: 'Item 2', price: 2000, status: 'active' },
          ],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
          },
          consumedCapacity: {
            totalRCU: 4.0,
            totalWCU: 0,
            operationCount: 1,
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const cursor = new FindCursor(
        'https://test-api.example.com',
        'test-collection',
        {
          status: 'active',
          price: { gte: 1000, lte: 5000 },
        },
        {},
        'test-token',
        undefined,
        undefined,
        async () => ({ Authorization: 'Bearer test-token' })
      );

      const results = await cursor.toArray();
      const cost = await cursor.getConsumedCapacity();

      expect(results).toHaveLength(2);
      expect(cost).toEqual({
        totalRCU: 4.0,
        totalWCU: 0,
        operationCount: 1,
      });
    });
  });

  describe('メソッドチェーン', () => {
    it('sort().limit().skip()のコスト情報', async () => {
      const mockResponse = {
        success: true,
        data: {
          items: [
            { id: 'item-3', name: 'Item 3', price: 300 },
            { id: 'item-4', name: 'Item 4', price: 400 },
          ],
          pageInfo: {
            hasNextPage: true,
            hasPreviousPage: true,
          },
          nextToken: 'next-token',
          consumedCapacity: {
            totalRCU: 2.5,
            totalWCU: 0,
            operationCount: 1,
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const cursor = new FindCursor(
        'https://test-api.example.com',
        'test-collection',
        { status: 'active' },
        {},
        'test-token',
        undefined,
        undefined,
        async () => ({ Authorization: 'Bearer test-token' })
      );

      const results = await cursor.sort({ price: 'desc' }).limit(2).skip(2).toArray();
      const cost = await cursor.getConsumedCapacity();

      expect(results).toHaveLength(2);
      expect(cost).toEqual({
        totalRCU: 2.5,
        totalWCU: 0,
        operationCount: 1,
      });
    });
  });

  describe('後方互換性', () => {
    it('getConsumedCapacity()を使用しないコードも正常に動作する', async () => {
      const mockResponse = {
        success: true,
        data: {
          items: [{ id: 'item-1', name: 'Item 1' }],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
          },
          consumedCapacity: {
            totalRCU: 1.0,
            totalWCU: 0,
            operationCount: 1,
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const cursor = new FindCursor(
        'https://test-api.example.com',
        'test-collection',
        {},
        {},
        'test-token',
        undefined,
        undefined,
        async () => ({ Authorization: 'Bearer test-token' })
      );

      // 既存のコード: getConsumedCapacity()を使用しない
      const results = await cursor.toArray();
      const pageInfo = await cursor.getPageInfo();

      expect(results).toHaveLength(1);
      expect(pageInfo.hasNextPage).toBe(false);
      // getConsumedCapacity()を呼ばなくてもエラーにならない
    });
  });

  describe('型安全性', () => {
    it('consumedCapacityの型が正しい', async () => {
      const mockResponse = {
        success: true,
        data: {
          items: [{ id: 'item-1', name: 'Item 1' }],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
          },
          consumedCapacity: {
            totalRCU: 1.0,
            totalWCU: 0,
            operationCount: 1,
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const cursor = new FindCursor(
        'https://test-api.example.com',
        'test-collection',
        {},
        {},
        'test-token',
        undefined,
        undefined,
        async () => ({ Authorization: 'Bearer test-token' })
      );

      const cost: AggregatedCost | undefined = await cursor.getConsumedCapacity();

      if (cost) {
        const rcu: number = cost.totalRCU;
        const wcu: number = cost.totalWCU;
        const count: number = cost.operationCount;

        expect(rcu).toBe(1.0);
        expect(wcu).toBe(0);
        expect(count).toBe(1);
      }
    });
  });
});
