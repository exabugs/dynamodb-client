/**
 * Collection クラスのコスト追跡テスト
 *
 * 要件: 9.1, 9.2, 10.3, 10.8
 *
 * このテストは、Collectionクラスの各操作でコスト情報が正しく返されることを検証します。
 * - insertOne, insertMany, updateOne, updateMany, deleteOne, deleteMany
 * - 後方互換性（consumedCapacityを使用しないコード）
 *
 * カバレッジ目標: 90%
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Collection } from '../../src/client/Collection.js';
import type { AggregatedCost } from '../../src/shared/types/consumed-capacity.js';

describe('Collection cost tracking', () => {
  let collection: Collection<{ id: string; name: string; status: string }>;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // fetchをモック
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Collectionインスタンスを作成
    collection = new Collection(
      'https://test-api.example.com',
      'test-collection',
      'test-token',
      undefined,
      undefined,
      async () => ({ Authorization: 'Bearer test-token' })
    );
  });

  describe('insertOne', () => {
    it('コスト情報を含むレスポンスを返す', async () => {
      const mockResponse = {
        success: true,
        data: {
          insertedId: 'test-id-1',
          consumedCapacity: {
            totalRCU: 0,
            totalWCU: 1.0,
            operationCount: 1,
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await collection.insertOne({
        name: 'Test Item',
        status: 'active',
      });

      expect(result.acknowledged).toBe(true);
      expect(result.insertedId).toBe('test-id-1');
      expect(result.consumedCapacity).toEqual({
        totalRCU: 0,
        totalWCU: 1.0,
        operationCount: 1,
      });
    });

    it('consumedCapacityが存在しない場合もエラーにならない', async () => {
      const mockResponse = {
        success: true,
        data: {
          insertedId: 'test-id-2',
          // consumedCapacityなし
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await collection.insertOne({
        name: 'Test Item',
        status: 'active',
      });

      expect(result.acknowledged).toBe(true);
      expect(result.insertedId).toBe('test-id-2');
      expect(result.consumedCapacity).toBeUndefined();
    });
  });

  describe('insertMany', () => {
    it('コスト情報を含むレスポンスを返す', async () => {
      const mockResponse = {
        success: true,
        data: {
          count: 3,
          successIds: {
            0: 'id-1',
            1: 'id-2',
            2: 'id-3',
          },
          consumedCapacity: {
            totalRCU: 0,
            totalWCU: 3.0,
            operationCount: 1,
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await collection.insertMany([
        { name: 'Item 1', status: 'active' },
        { name: 'Item 2', status: 'active' },
        { name: 'Item 3', status: 'active' },
      ]);

      expect(result.acknowledged).toBe(true);
      expect(result.insertedCount).toBe(3);
      expect(result.consumedCapacity).toEqual({
        totalRCU: 0,
        totalWCU: 3.0,
        operationCount: 1,
      });
    });

    it('部分失敗の場合もコスト情報を返す', async () => {
      const mockResponse = {
        success: true,
        data: {
          count: 2,
          successIds: {
            0: 'id-1',
            2: 'id-3',
          },
          failedIds: ['id-2'],
          errors: [
            {
              id: 'id-2',
              code: 'ValidationError',
              message: 'Invalid data',
            },
          ],
          consumedCapacity: {
            totalRCU: 0,
            totalWCU: 2.5,
            operationCount: 1,
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await collection.insertMany([
        { name: 'Item 1', status: 'active' },
        { name: 'Item 2', status: 'invalid' },
        { name: 'Item 3', status: 'active' },
      ]);

      expect(result.acknowledged).toBe(true);
      expect(result.insertedCount).toBe(2);
      expect(result.failedIds).toEqual(['id-2']);
      expect(result.consumedCapacity).toEqual({
        totalRCU: 0,
        totalWCU: 2.5,
        operationCount: 1,
      });
    });
  });

  describe('updateOne', () => {
    it('コスト情報を含むレスポンスを返す', async () => {
      const mockResponse = {
        success: true,
        data: {
          matchedCount: 1,
          modifiedCount: 1,
          consumedCapacity: {
            totalRCU: 1.0,
            totalWCU: 1.0,
            operationCount: 2,
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await collection.updateOne(
        { id: 'test-id' },
        { $set: { status: 'inactive' } }
      );

      expect(result.acknowledged).toBe(true);
      expect(result.matchedCount).toBe(1);
      expect(result.modifiedCount).toBe(1);
      expect(result.consumedCapacity).toEqual({
        totalRCU: 1.0,
        totalWCU: 1.0,
        operationCount: 2,
      });
    });

    it('upsertの場合もコスト情報を返す', async () => {
      const mockResponse = {
        success: true,
        data: {
          matchedCount: 0,
          modifiedCount: 0,
          __upsertedId: 'new-id',
          consumedCapacity: {
            totalRCU: 0,
            totalWCU: 1.0,
            operationCount: 1,
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await collection.updateOne(
        { id: 'new-id' },
        { $set: { name: 'New Item', status: 'active' } },
        { upsert: true }
      );

      expect(result.acknowledged).toBe(true);
      expect(result.matchedCount).toBe(0);
      expect(result.modifiedCount).toBe(0);
      expect(result.upsertedId).toBe('new-id');
      expect(result.consumedCapacity).toEqual({
        totalRCU: 0,
        totalWCU: 1.0,
        operationCount: 1,
      });
    });
  });

  describe('updateMany', () => {
    it('コスト情報を含むレスポンスを返す', async () => {
      const mockResponse = {
        success: true,
        data: {
          count: 3,
          successIds: {
            'id-1': 'id-1',
            'id-2': 'id-2',
            'id-3': 'id-3',
          },
          consumedCapacity: {
            totalRCU: 3.0,
            totalWCU: 3.0,
            operationCount: 4,
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await collection.updateMany(
        { status: 'active' },
        { $set: { status: 'inactive' } }
      );

      expect(result.acknowledged).toBe(true);
      expect(result.matchedCount).toBe(3);
      expect(result.modifiedCount).toBe(3);
      expect(result.consumedCapacity).toEqual({
        totalRCU: 3.0,
        totalWCU: 3.0,
        operationCount: 4,
      });
    });

    it('部分失敗の場合もコスト情報を返す', async () => {
      const mockResponse = {
        success: true,
        data: {
          count: 2,
          successIds: {
            'id-1': 'id-1',
            'id-3': 'id-3',
          },
          failedIds: {
            'id-2': 'id-2',
          },
          consumedCapacity: {
            totalRCU: 3.0,
            totalWCU: 2.5,
            operationCount: 4,
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await collection.updateMany(
        { status: 'active' },
        { $set: { status: 'inactive' } }
      );

      expect(result.acknowledged).toBe(true);
      expect(result.matchedCount).toBe(3); // 成功2 + 失敗1
      expect(result.modifiedCount).toBe(2);
      expect(result.consumedCapacity).toEqual({
        totalRCU: 3.0,
        totalWCU: 2.5,
        operationCount: 4,
      });
    });
  });

  describe('deleteOne', () => {
    it('コスト情報を含むレスポンスを返す', async () => {
      const mockResponse = {
        success: true,
        data: {
          deletedCount: 1,
          consumedCapacity: {
            totalRCU: 1.0,
            totalWCU: 1.0,
            operationCount: 2,
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await collection.deleteOne({ id: 'test-id' });

      expect(result.acknowledged).toBe(true);
      expect(result.deletedCount).toBe(1);
      expect(result.consumedCapacity).toEqual({
        totalRCU: 1.0,
        totalWCU: 1.0,
        operationCount: 2,
      });
    });

    it('レコードが見つからない場合もコスト情報を返す', async () => {
      const mockResponse = {
        success: true,
        data: {
          deletedCount: 0,
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

      const result = await collection.deleteOne({ id: 'non-existent-id' });

      expect(result.acknowledged).toBe(true);
      expect(result.deletedCount).toBe(0);
      expect(result.consumedCapacity).toEqual({
        totalRCU: 0.5,
        totalWCU: 0,
        operationCount: 1,
      });
    });
  });

  describe('deleteMany', () => {
    it('コスト情報を含むレスポンスを返す', async () => {
      const mockResponse = {
        success: true,
        data: {
          count: 5,
          consumedCapacity: {
            totalRCU: 5.0,
            totalWCU: 5.0,
            operationCount: 6,
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await collection.deleteMany({ status: 'inactive' });

      expect(result.acknowledged).toBe(true);
      expect(result.deletedCount).toBe(5);
      expect(result.consumedCapacity).toEqual({
        totalRCU: 5.0,
        totalWCU: 5.0,
        operationCount: 6,
      });
    });

    it('レコードが見つからない場合もコスト情報を返す', async () => {
      const mockResponse = {
        success: true,
        data: {
          count: 0,
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

      const result = await collection.deleteMany({ status: 'non-existent' });

      expect(result.acknowledged).toBe(true);
      expect(result.deletedCount).toBe(0);
      expect(result.consumedCapacity).toEqual({
        totalRCU: 1.0,
        totalWCU: 0,
        operationCount: 1,
      });
    });
  });

  describe('後方互換性', () => {
    it('consumedCapacityを使用しないコードも正常に動作する', async () => {
      const mockResponse = {
        success: true,
        data: {
          insertedId: 'test-id',
          consumedCapacity: {
            totalRCU: 0,
            totalWCU: 1.0,
            operationCount: 1,
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      // consumedCapacityを使用しない既存コード
      const result = await collection.insertOne({
        name: 'Test Item',
        status: 'active',
      });

      // 既存のフィールドは正常に動作
      expect(result.acknowledged).toBe(true);
      expect(result.insertedId).toBe('test-id');

      // consumedCapacityは存在するが、使用しなくてもエラーにならない
      expect(result.consumedCapacity).toBeDefined();
    });

    it('consumedCapacityが存在しない古いレスポンスも処理できる', async () => {
      const mockResponse = {
        success: true,
        data: {
          insertedId: 'test-id',
          // consumedCapacityなし（古いバージョンのレスポンス）
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await collection.insertOne({
        name: 'Test Item',
        status: 'active',
      });

      expect(result.acknowledged).toBe(true);
      expect(result.insertedId).toBe('test-id');
      expect(result.consumedCapacity).toBeUndefined();
    });
  });

  describe('型安全性', () => {
    it('consumedCapacityの型が正しい', async () => {
      const mockResponse = {
        success: true,
        data: {
          insertedId: 'test-id',
          consumedCapacity: {
            totalRCU: 0,
            totalWCU: 1.0,
            operationCount: 1,
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await collection.insertOne({
        name: 'Test Item',
        status: 'active',
      });

      // TypeScriptの型チェックが通ることを確認
      const cost: AggregatedCost | undefined = result.consumedCapacity;

      if (cost) {
        const rcu: number = cost.totalRCU;
        const wcu: number = cost.totalWCU;
        const count: number = cost.operationCount;

        expect(rcu).toBe(0);
        expect(wcu).toBe(1.0);
        expect(count).toBe(1);
      }
    });
  });
});
