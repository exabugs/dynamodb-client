/**
 * Collectionクラスのテスト
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Collection } from '../src/client/Collection.js';
import type { Filter, UpdateOperators } from '../src/types.js';

// fetchをモック
global.fetch = vi.fn();

interface Product {
  id: string;
  name: string;
  price: number;
  status: 'active' | 'inactive';
}

describe('Collection', () => {
  const MOCK_ENDPOINT = 'https://example.lambda-url.us-east-1.on.aws';
  const MOCK_DATABASE = 'test-db';
  const MOCK_COLLECTION = 'products';
  const MOCK_TOKEN = 'mock-token';
  const MOCK_AUTH_OPTIONS = {
    type: 'token' as const,
    token: MOCK_TOKEN,
  };

  let collection: Collection<Product>;

  // モック認証ハンドラー
  const mockGetAuthHeaders = vi.fn(async () => ({
    Authorization: `Bearer ${MOCK_TOKEN}`,
  }));

  beforeEach(() => {
    collection = new Collection<Product>(
      MOCK_ENDPOINT,
      MOCK_DATABASE,
      MOCK_COLLECTION,
      undefined, // authToken (deprecated)
      MOCK_AUTH_OPTIONS, // authOptions
      undefined, // clientOptions
      mockGetAuthHeaders // getAuthHeaders
    );
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('コレクションを作成できる', () => {
      expect(collection).toBeInstanceOf(Collection);
      expect(collection.getName()).toBe(MOCK_COLLECTION);
      expect(collection.getDatabaseName()).toBe(MOCK_DATABASE);
      expect(collection.getEndpoint()).toBe(MOCK_ENDPOINT);
      expect(collection.getAuthOptions()).toEqual(MOCK_AUTH_OPTIONS);
    });
  });

  describe('find', () => {
    it('FindCursorを返す', () => {
      const cursor = collection.find({ status: 'active' });
      expect(cursor).toBeDefined();
      expect(typeof cursor.toArray).toBe('function');
    });

    it('空のフィルタでFindCursorを返す', () => {
      const cursor = collection.find();
      expect(cursor).toBeDefined();
    });
  });

  describe('findOne', () => {
    it('単一ドキュメントを取得する', async () => {
      const mockProduct: Product = {
        id: 'prod-123',
        name: 'Product 1',
        price: 1000,
        status: 'active',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockProduct }),
      });

      const result = await collection.findOne({ id: 'prod-123' });

      expect(result).toEqual(mockProduct);
      expect(global.fetch).toHaveBeenCalledWith(
        MOCK_ENDPOINT,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: `Bearer ${MOCK_TOKEN}`,
          }),
          body: expect.stringContaining('findOne'),
        })
      );
    });

    it('ドキュメントが見つからない場合nullを返す', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: {} }),
      });

      const result = await collection.findOne({ id: 'not-found' });
      expect(result).toBeNull();
    });
  });

  describe('insertOne', () => {
    it('単一ドキュメントを挿入する', async () => {
      const mockProduct: Product = {
        id: 'prod-123',
        name: 'Product 1',
        price: 1000,
        status: 'active',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { insertedId: 'prod-123' } }),
      });

      const result = await collection.insertOne(mockProduct);

      expect(result).toEqual({
        acknowledged: true,
        insertedId: 'prod-123',
      });
    });
  });

  describe('findMany', () => {
    it('複数ドキュメントをIDで取得する', async () => {
      const mockProducts: Product[] = [
        { id: 'prod-1', name: 'Product 1', price: 1000, status: 'active' },
        { id: 'prod-2', name: 'Product 2', price: 2000, status: 'active' },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockProducts }),
      });

      const result = await collection.findMany(['prod-1', 'prod-2']);

      expect(result).toEqual(mockProducts);
      expect(global.fetch).toHaveBeenCalledWith(
        MOCK_ENDPOINT,
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('findMany'),
        })
      );
    });

    it('空の配列の場合は空配列を返す', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const result = await collection.findMany([]);
      expect(result).toEqual([]);
    });

    it('レスポンスがオブジェクトの場合はitemsを返す', async () => {
      const mockProducts: Product[] = [
        { id: 'prod-1', name: 'Product 1', price: 1000, status: 'active' },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { items: mockProducts } }),
      });

      const result = await collection.findMany(['prod-1']);
      expect(result).toEqual(mockProducts);
    });
  });

  describe('insertMany', () => {
    it('複数ドキュメントを挿入する（新形式レスポンス）', async () => {
      const mockProducts: Product[] = [
        { id: 'prod-1', name: 'Product 1', price: 1000, status: 'active' },
        { id: 'prod-2', name: 'Product 2', price: 2000, status: 'active' },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            count: 2,
            successIds: { 0: 'prod-1', 1: 'prod-2' },
            failedIds: {},
            errors: {},
          },
        }),
      });

      const result = await collection.insertMany(mockProducts);

      expect(result).toEqual({
        acknowledged: true,
        insertedCount: 2,
        insertedIds: { 0: 'prod-1', 1: 'prod-2' },
        errors: {},
        failedIds: {},
      });
    });

    it('部分失敗の場合はfailedIdsとerrorsを返す', async () => {
      const mockProducts: Product[] = [
        { id: 'prod-1', name: 'Product 1', price: 1000, status: 'active' },
        { id: 'prod-2', name: 'Product 2', price: 2000, status: 'active' },
        { id: 'prod-3', name: 'Product 3', price: 3000, status: 'active' },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            count: 2,
            successIds: { 0: 'prod-1', 2: 'prod-3' },
            failedIds: { 1: 'prod-2' },
            errors: { 1: { id: 'prod-2', code: 'DUPLICATE_KEY', message: 'Already exists' } },
          },
        }),
      });

      const result = await collection.insertMany(mockProducts);

      expect(result).toEqual({
        acknowledged: true,
        insertedCount: 2,
        insertedIds: { 0: 'prod-1', 2: 'prod-3' },
        errors: { 1: { id: 'prod-2', code: 'DUPLICATE_KEY', message: 'Already exists' } },
        failedIds: { 1: 'prod-2' },
      });
    });
  });

  describe('updateOne', () => {
    it('単一ドキュメントを更新する', async () => {
      const filter: Filter<Product> = { id: 'prod-123' };
      const update: UpdateOperators<Product> = {
        set: { status: 'inactive' },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            matchedCount: 1,
            modifiedCount: 1,
          },
        }),
      });

      const result = await collection.updateOne(filter, update);

      expect(result).toEqual({
        acknowledged: true,
        matchedCount: 1,
        modifiedCount: 1,
        upsertedId: undefined,
      });
    });
  });

  describe('updateMany', () => {
    it('複数ドキュメントを更新する', async () => {
      const filter: Filter<Product> = { status: 'inactive' };
      const update: UpdateOperators<Product> = {
        set: { status: 'active' },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            count: 5,
            successIds: { 0: 'id1', 1: 'id2', 2: 'id3', 3: 'id4', 4: 'id5' },
            failedIds: {},
            errors: {},
          },
        }),
      });

      const result = await collection.updateMany(filter, update);

      expect(result).toEqual({
        acknowledged: true,
        matchedCount: 5,
        modifiedCount: 5,
      });
    });
  });

  describe('deleteOne', () => {
    it('単一ドキュメントを削除する', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            deletedCount: 1,
          },
        }),
      });

      const result = await collection.deleteOne({ id: 'prod-123' });

      expect(result).toEqual({
        acknowledged: true,
        deletedCount: 1,
      });
    });
  });

  describe('deleteMany', () => {
    it('複数ドキュメントを削除する', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            count: 3,
            successIds: { 0: 'id1', 1: 'id2', 2: 'id3' },
            failedIds: {},
            errors: {},
          },
        }),
      });

      const result = await collection.deleteMany({ status: 'inactive' });

      expect(result).toEqual({
        acknowledged: true,
        deletedCount: 3,
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

      await expect(collection.findOne({ id: 'prod-123' })).rejects.toThrow(
        'Request failed: Database error'
      );
    });

    it('JSONパースエラーの場合はstatusTextを使用する', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await expect(collection.findOne({ id: 'prod-123' })).rejects.toThrow(
        'Request failed: Bad Request'
      );
    });
  });
});
