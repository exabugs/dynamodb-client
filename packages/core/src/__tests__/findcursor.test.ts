/**
 * FindCursorクラスのテスト
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FindCursor } from '../client/FindCursor.js';
import type { Filter } from '../types.js';

// fetchをモック
global.fetch = vi.fn();

interface Product {
  id: string;
  name: string;
  price: number;
  status: 'active' | 'inactive';
}

describe('FindCursor', () => {
  const MOCK_ENDPOINT = 'https://example.lambda-url.us-east-1.on.aws';
  const MOCK_DATABASE = 'test-db';
  const MOCK_COLLECTION = 'products';
  const MOCK_TOKEN = 'mock-token';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sort', () => {
    it('ソート条件を設定できる', () => {
      const filter: Filter<Product> = { status: 'active' };
      const cursor = new FindCursor<Product>(
        MOCK_ENDPOINT,
        MOCK_DATABASE,
        MOCK_COLLECTION,
        filter,
        {},
        MOCK_TOKEN
      );

      const result = cursor.sort({ price: 'desc' });
      expect(result).toBe(cursor); // メソッドチェーン用にthisを返す
    });

    it('複数フィールドでソート条件を設定できる', () => {
      const filter: Filter<Product> = { status: 'active' };
      const cursor = new FindCursor<Product>(
        MOCK_ENDPOINT,
        MOCK_DATABASE,
        MOCK_COLLECTION,
        filter,
        {},
        MOCK_TOKEN
      );

      const result = cursor.sort({ price: 'desc', name: 'asc' });
      expect(result).toBe(cursor);
    });

    it('数値形式でソート条件を設定できる', () => {
      const filter: Filter<Product> = { status: 'active' };
      const cursor = new FindCursor<Product>(
        MOCK_ENDPOINT,
        MOCK_DATABASE,
        MOCK_COLLECTION,
        filter,
        {},
        MOCK_TOKEN
      );

      const result = cursor.sort({ price: -1, name: 1 });
      expect(result).toBe(cursor);
    });
  });

  describe('limit', () => {
    it('取得件数を制限できる', () => {
      const filter: Filter<Product> = { status: 'active' };
      const cursor = new FindCursor<Product>(
        MOCK_ENDPOINT,
        MOCK_DATABASE,
        MOCK_COLLECTION,
        filter,
        {},
        MOCK_TOKEN
      );

      const result = cursor.limit(10);
      expect(result).toBe(cursor);
    });
  });

  describe('skip', () => {
    it('スキップする件数を設定できる', () => {
      const filter: Filter<Product> = { status: 'active' };
      const cursor = new FindCursor<Product>(
        MOCK_ENDPOINT,
        MOCK_DATABASE,
        MOCK_COLLECTION,
        filter,
        {},
        MOCK_TOKEN
      );

      const result = cursor.skip(20);
      expect(result).toBe(cursor);
    });
  });

  describe('toArray', () => {
    it('クエリを実行して結果を配列で返す', async () => {
      const mockProducts: Product[] = [
        { id: 'prod-1', name: 'Product 1', price: 1000, status: 'active' },
        { id: 'prod-2', name: 'Product 2', price: 2000, status: 'active' },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            documents: mockProducts,
          },
        }),
      });

      const filter: Filter<Product> = { status: 'active' };
      const cursor = new FindCursor<Product>(
        MOCK_ENDPOINT,
        MOCK_DATABASE,
        MOCK_COLLECTION,
        filter,
        {},
        MOCK_TOKEN
      );

      const results = await cursor.toArray();

      expect(results).toEqual(mockProducts);
      expect(global.fetch).toHaveBeenCalledWith(
        MOCK_ENDPOINT,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: `Bearer ${MOCK_TOKEN}`,
          }),
          body: expect.stringContaining('find'),
        })
      );
    });

    it('空の結果を返す', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            documents: [],
          },
        }),
      });

      const filter: Filter<Product> = { status: 'inactive' };
      const cursor = new FindCursor<Product>(
        MOCK_ENDPOINT,
        MOCK_DATABASE,
        MOCK_COLLECTION,
        filter,
        {},
        MOCK_TOKEN
      );

      const results = await cursor.toArray();
      expect(results).toEqual([]);
    });

    it('documentsフィールドがない場合は空配列を返す', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {},
        }),
      });

      const filter: Filter<Product> = { status: 'active' };
      const cursor = new FindCursor<Product>(
        MOCK_ENDPOINT,
        MOCK_DATABASE,
        MOCK_COLLECTION,
        filter,
        {},
        MOCK_TOKEN
      );

      const results = await cursor.toArray();
      expect(results).toEqual([]);
    });

    it('複数回呼び出しても1回だけクエリを実行する', async () => {
      const mockProducts: Product[] = [
        { id: 'prod-1', name: 'Product 1', price: 1000, status: 'active' },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            documents: mockProducts,
          },
        }),
      });

      const filter: Filter<Product> = { status: 'active' };
      const cursor = new FindCursor<Product>(
        MOCK_ENDPOINT,
        MOCK_DATABASE,
        MOCK_COLLECTION,
        filter,
        {},
        MOCK_TOKEN
      );

      const results1 = await cursor.toArray();
      const results2 = await cursor.toArray();

      expect(results1).toEqual(mockProducts);
      expect(results2).toEqual(mockProducts);
      expect(global.fetch).toHaveBeenCalledTimes(1); // 1回だけ呼ばれる
    });
  });

  describe('メソッドチェーン', () => {
    it('sort、limit、skipをチェーンできる', async () => {
      const mockProducts: Product[] = [
        { id: 'prod-1', name: 'Product 1', price: 1000, status: 'active' },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            documents: mockProducts,
          },
        }),
      });

      const filter: Filter<Product> = { status: 'active' };
      const cursor = new FindCursor<Product>(
        MOCK_ENDPOINT,
        MOCK_DATABASE,
        MOCK_COLLECTION,
        filter,
        {},
        MOCK_TOKEN
      );

      const results = await cursor.sort({ price: 'desc' }).limit(10).skip(20).toArray();

      expect(results).toEqual(mockProducts);

      // リクエストボディにオプションが含まれていることを確認
      const callArgs = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      expect(requestBody.params.options).toEqual({
        sort: { price: 'desc' },
        limit: 10,
        skip: 20,
      });
    });
  });

  describe('エラーハンドリング', () => {
    it('HTTPエラーの場合は例外をスローする', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
        json: async () => ({ message: 'Database error' }),
      });

      const filter: Filter<Product> = { status: 'active' };
      const cursor = new FindCursor<Product>(
        MOCK_ENDPOINT,
        MOCK_DATABASE,
        MOCK_COLLECTION,
        filter,
        {},
        MOCK_TOKEN
      );

      await expect(cursor.toArray()).rejects.toThrow('Request failed: Database error');
    });

    it('JSONパースエラーの場合はstatusTextを使用する', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      const filter: Filter<Product> = { status: 'active' };
      const cursor = new FindCursor<Product>(
        MOCK_ENDPOINT,
        MOCK_DATABASE,
        MOCK_COLLECTION,
        filter,
        {},
        MOCK_TOKEN
      );

      await expect(cursor.toArray()).rejects.toThrow('Request failed: Bad Request');
    });
  });
});
