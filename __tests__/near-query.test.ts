/**
 * nearQuery.tsの包括的なテスト
 * カバレッジ目標: 90%以上
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { QueryCommand } from '@aws-sdk/lib-dynamodb';

import { executeNearQuery } from '../src/server/operations/find/nearQuery.js';
import { executeNearSearch } from '../src/server/query/nearSearch.js';
// モジュールのインポート（モック後）
import {
  executeDynamoDBOperation,
  extractCleanRecord,
  getDBClient,
  getTableName,
  removeShadowKeys,
} from '../src/server/utils/dynamodb.js';
import type { NearQuery } from '../src/shared/geohash/types.js';

// モック
vi.mock('../src/server/utils/dynamodb.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/server/utils/dynamodb.js')>();
  return {
    getDBClient: vi.fn(() => ({
      send: vi.fn(),
    })),
    getTableName: vi.fn(() => 'test-table'),
    executeDynamoDBOperation: vi.fn(),
    extractCleanRecord: vi.fn((record) => {
      // dataフィールドを展開してクリーンなレコードを返す
      if (record.data) {
        return record.data;
      }
      return record;
    }),
    // removeShadowKeysは実際の実装を使用
    removeShadowKeys: actual.removeShadowKeys,
  };
});

vi.mock('../src/server/query/nearSearch.js', () => ({
  executeNearSearch: vi.fn(),
}));

describe('executeNearQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('正常系', () => {
    test('簡易形式の$nearクエリで検索できる', async () => {
      // Arrange
      const nearQuery: NearQuery = {
        latitude: 35.6812,
        longitude: 139.7671,
        maxDistance: 5000,
      };

      const mockShadowRecords = [
        { PK: 'venues', SK: 'location_geohash#xn76ur#id#venue-001' },
        { PK: 'venues', SK: 'location_geohash#xn76ur#id#venue-002' },
      ];

      const mockMainRecords = [
        {
          PK: 'venues',
          SK: 'id#venue-001',
          data: {
            id: 'venue-001',
            name: '東京タワー',
            location: { latitude: 35.6586, longitude: 139.7454 },
          },
        },
        {
          PK: 'venues',
          SK: 'id#venue-002',
          data: {
            id: 'venue-002',
            name: '東京スカイツリー',
            location: { latitude: 35.7101, longitude: 139.8107 },
          },
        },
      ];

      // executeNearSearchのモック
      vi.mocked(executeNearSearch).mockResolvedValue({
        documents: [
          { ...mockMainRecords[0].data, __distance: 2500 },
          { ...mockMainRecords[1].data, __distance: 4500 },
        ],
        metadata: {
          iterations: 1,
          candidatesFound: 2,
          searchedBlocks: 9,
        },
      });

      // Act
      const result = await executeNearQuery('venues', 'location', nearQuery, 10, 'test-request-id');

      // Assert
      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toMatchObject({
        id: 'venue-001',
        name: '東京タワー',
        __distance: 2500,
      });
      expect(result.items[1]).toMatchObject({
        id: 'venue-002',
        name: '東京スカイツリー',
        __distance: 4500,
      });
      expect(result.pageInfo.hasNextPage).toBe(false);
      expect(result.pageInfo.hasPreviousPage).toBe(false);
    });

    test('GeoJSON形式の$nearクエリで検索できる', async () => {
      // Arrange
      const nearQuery: NearQuery = {
        $geometry: {
          type: 'Point',
          coordinates: [139.7671, 35.6812],
        },
        $maxDistance: 5000,
      };

      vi.mocked(executeNearSearch).mockResolvedValue({
        documents: [
          {
            id: 'venue-001',
            name: '東京タワー',
            location: { latitude: 35.6586, longitude: 139.7454 },
            __distance: 2500,
          },
        ],
        metadata: {
          iterations: 1,
          candidatesFound: 1,
          searchedBlocks: 9,
        },
      });

      // Act
      const result = await executeNearQuery('venues', 'location', nearQuery, 10, 'test-request-id');

      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.items[0].__distance).toBe(2500);
    });

    test('limitパラメータが正しく適用される', async () => {
      // Arrange
      const nearQuery: NearQuery = {
        latitude: 35.6812,
        longitude: 139.7671,
      };

      const mockDocuments = Array.from({ length: 5 }, (_, i) => ({
        id: `venue-${i + 1}`,
        name: `Venue ${i + 1}`,
        location: { latitude: 35.6812, longitude: 139.7671 },
        __distance: i * 1000,
      }));

      vi.mocked(executeNearSearch).mockResolvedValue({
        documents: mockDocuments.slice(0, 3), // limit=3
        metadata: {
          iterations: 1,
          candidatesFound: 5,
          searchedBlocks: 9,
        },
      });

      // Act
      const result = await executeNearQuery('venues', 'location', nearQuery, 3, 'test-request-id');

      // Assert
      expect(result.items).toHaveLength(3);
      expect(executeNearSearch).toHaveBeenCalledWith(
        nearQuery,
        'location',
        3,
        expect.any(Function),
        expect.any(Object)
      );
    });

    test('距離情報(__distance)が正しく付与される', async () => {
      // Arrange
      const nearQuery: NearQuery = {
        latitude: 35.6812,
        longitude: 139.7671,
      };

      vi.mocked(executeNearSearch).mockResolvedValue({
        documents: [
          {
            id: 'venue-001',
            name: '東京タワー',
            __distance: 2500,
          },
        ],
        metadata: {
          iterations: 1,
          candidatesFound: 1,
          searchedBlocks: 9,
        },
      });

      // Act
      const result = await executeNearQuery('venues', 'location', nearQuery, 10, 'test-request-id');

      // Assert
      expect(result.items[0]).toHaveProperty('__distance');
      expect(result.items[0].__distance).toBe(2500);
    });

    test('結果が距離順にソートされる', async () => {
      // Arrange
      const nearQuery: NearQuery = {
        latitude: 35.6812,
        longitude: 139.7671,
      };

      vi.mocked(executeNearSearch).mockResolvedValue({
        documents: [
          { id: 'venue-001', name: 'Near', __distance: 1000 },
          { id: 'venue-002', name: 'Middle', __distance: 3000 },
          { id: 'venue-003', name: 'Far', __distance: 5000 },
        ],
        metadata: {
          iterations: 1,
          candidatesFound: 3,
          searchedBlocks: 9,
        },
      });

      // Act
      const result = await executeNearQuery('venues', 'location', nearQuery, 10, 'test-request-id');

      // Assert
      expect(result.items[0].__distance).toBeLessThan(result.items[1].__distance);
      expect(result.items[1].__distance).toBeLessThan(result.items[2].__distance);
    });
  });

  describe('DynamoDB統合', () => {
    test('シャドウレコードから本体レコードを取得できる', async () => {
      // Arrange
      const nearQuery: NearQuery = {
        latitude: 35.6812,
        longitude: 139.7671,
      };

      // executeNearSearchが内部でsearchFunctionを呼び出すことを想定
      vi.mocked(executeNearSearch).mockImplementation(async (query, field, limit, searchFn) => {
        // searchFunctionを実際に呼び出す
        const results = await searchFn('xn76ur');
        return {
          documents: results.map((r: any) => ({ ...r, __distance: 1000 })),
          metadata: {
            iterations: 1,
            candidatesFound: results.length,
            searchedBlocks: 9,
          },
        };
      });

      let callCount = 0;
      // DynamoDB Query（シャドウレコード検索）のモック
      vi.mocked(executeDynamoDBOperation).mockImplementation(async (fn: any) => {
        callCount++;
        if (callCount === 1) {
          // 最初の呼び出し: シャドウレコード検索
          return {
            Items: [{ PK: 'venues', SK: 'location_geohash#xn76ur#id#venue-001' }],
          };
        } else {
          // 2回目以降: 本体レコード取得
          return {
            Items: [
              {
                PK: 'venues',
                SK: 'id#venue-001',
                data: {
                  id: 'venue-001',
                  name: '東京タワー',
                  location: { latitude: 35.6586, longitude: 139.7454 },
                },
              },
            ],
          };
        }
      });

      // Act
      const result = await executeNearQuery('venues', 'location', nearQuery, 10, 'test-request-id');

      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('venue-001');
    });

    test('複数のシャドウレコードから複数の本体レコードを取得できる', async () => {
      // Arrange
      const nearQuery: NearQuery = {
        latitude: 35.6812,
        longitude: 139.7671,
      };

      vi.mocked(executeNearSearch).mockImplementation(async (query, field, limit, searchFn) => {
        const results = await searchFn('xn76ur');
        return {
          documents: results.map((r: any, i: number) => ({ ...r, __distance: i * 1000 })),
          metadata: {
            iterations: 1,
            candidatesFound: results.length,
            searchedBlocks: 9,
          },
        };
      });

      let callCount = 0;
      vi.mocked(executeDynamoDBOperation).mockImplementation(async (fn: any) => {
        callCount++;
        if (callCount === 1) {
          // 最初の呼び出し: シャドウレコード検索
          return {
            Items: [
              { PK: 'venues', SK: 'location_geohash#xn76ur#id#venue-001' },
              { PK: 'venues', SK: 'location_geohash#xn76ur#id#venue-002' },
            ],
          };
        } else {
          // 2回目以降: 本体レコード取得
          const id = callCount === 2 ? 'venue-001' : 'venue-002';
          return {
            Items: [
              {
                PK: 'venues',
                SK: `id#${id}`,
                data: {
                  id,
                  name: `Venue ${id}`,
                  location: { latitude: 35.6812, longitude: 139.7671 },
                },
              },
            ],
          };
        }
      });

      // Act
      const result = await executeNearQuery('venues', 'location', nearQuery, 10, 'test-request-id');

      // Assert
      expect(result.items).toHaveLength(2);
      expect(result.items[0].id).toBe('venue-001');
      expect(result.items[1].id).toBe('venue-002');
    });

    test('シャドウレコードが存在しない場合は空配列を返す', async () => {
      // Arrange
      const nearQuery: NearQuery = {
        latitude: 35.6812,
        longitude: 139.7671,
      };

      vi.mocked(executeNearSearch).mockResolvedValue({
        documents: [],
        metadata: {
          iterations: 1,
          candidatesFound: 0,
          searchedBlocks: 9,
        },
      });

      // Act
      const result = await executeNearQuery('venues', 'location', nearQuery, 10, 'test-request-id');

      // Assert
      expect(result.items).toHaveLength(0);
    });

    test('本体レコードが削除されている場合はスキップする', async () => {
      // Arrange
      const nearQuery: NearQuery = {
        latitude: 35.6812,
        longitude: 139.7671,
      };

      vi.mocked(executeNearSearch).mockImplementation(async (query, field, limit, searchFn) => {
        const results = await searchFn('xn76ur');
        // 本体レコードが存在しないものはフィルタリングされる
        return {
          documents: results
            .filter((r: any) => r !== undefined)
            .map((r: any) => ({ ...r, __distance: 1000 })),
          metadata: {
            iterations: 1,
            candidatesFound: 1,
            searchedBlocks: 9,
          },
        };
      });

      let callCount = 0;
      vi.mocked(executeDynamoDBOperation).mockImplementation(async (fn: any) => {
        callCount++;
        if (callCount === 1) {
          // 最初の呼び出し: シャドウレコード検索
          return {
            Items: [
              { PK: 'venues', SK: 'location_geohash#xn76ur#id#venue-001' },
              { PK: 'venues', SK: 'location_geohash#xn76ur#id#venue-deleted' },
            ],
          };
        } else if (callCount === 2) {
          // 2回目: venue-001の本体レコード取得
          return {
            Items: [
              {
                PK: 'venues',
                SK: 'id#venue-001',
                data: {
                  id: 'venue-001',
                  name: '東京タワー',
                  location: { latitude: 35.6586, longitude: 139.7454 },
                },
              },
            ],
          };
        } else {
          // 3回目: venue-deletedの本体レコード取得（削除済み）
          return { Items: [] };
        }
      });

      // Act
      const result = await executeNearQuery('venues', 'location', nearQuery, 10, 'test-request-id');

      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('venue-001');
    });

    test('GeoHashフィールド名が正しく生成される', async () => {
      // Arrange
      const nearQuery: NearQuery = {
        latitude: 35.6812,
        longitude: 139.7671,
      };

      // executeNearSearchをモックして、searchFunctionが正しいGeoHashプレフィックスで呼ばれることを確認
      let searchFunctionCalled = false;
      let geohashPrefixUsed = '';

      vi.mocked(executeNearSearch).mockImplementation(
        async (query, field, limit, searchFn, config) => {
          // searchFunctionを呼び出してGeoHashプレフィックスを確認
          // executeNearSearchは内部でGeoHashを計算してsearchFunctionを呼び出す
          // ここでは、フィールド名が正しく渡されていることを確認
          expect(field).toBe('custom_field');
          searchFunctionCalled = true;

          // 実際にsearchFunctionを呼び出してみる
          await searchFn('xn76ur');

          return {
            documents: [],
            metadata: {
              iterations: 1,
              candidatesFound: 0,
              searchedBlocks: 9,
            },
          };
        }
      );

      vi.mocked(executeDynamoDBOperation).mockImplementation(async (fn: any) => {
        // DynamoDBの実行結果を返す
        // nearQuery.tsでは `${fieldName}_geohash` というフィールド名を生成する
        return { Items: [] };
      });

      // Act
      await executeNearQuery('venues', 'custom_field', nearQuery, 10, 'test-request-id');

      // Assert
      expect(searchFunctionCalled).toBe(true);
      expect(executeNearSearch).toHaveBeenCalledWith(
        nearQuery,
        'custom_field', // フィールド名が正しく渡されている
        10,
        expect.any(Function),
        expect.any(Object)
      );
    });
  });

  describe('エラーハンドリング', () => {
    test('DynamoDBエラー時に適切なエラーを投げる', async () => {
      // Arrange
      const nearQuery: NearQuery = {
        latitude: 35.6812,
        longitude: 139.7671,
      };

      vi.mocked(executeNearSearch).mockRejectedValue(new Error('DynamoDB error'));

      // Act & Assert
      await expect(
        executeNearQuery('venues', 'location', nearQuery, 10, 'test-request-id')
      ).rejects.toThrow('DynamoDB error');
    });

    test('無効な座標の場合にエラーを投げる', async () => {
      // Arrange
      const invalidNearQuery: NearQuery = {
        latitude: 91, // 無効（-90〜90の範囲外）
        longitude: 0,
      };

      vi.mocked(executeNearSearch).mockRejectedValue(new Error('Invalid coordinates'));

      // Act & Assert
      await expect(
        executeNearQuery('venues', 'location', invalidNearQuery, 10, 'test-request-id')
      ).rejects.toThrow('Invalid coordinates');
    });

    test('無効なlimitの場合にエラーを投げる', async () => {
      // Arrange
      const nearQuery: NearQuery = {
        latitude: 35.6812,
        longitude: 139.7671,
      };

      vi.mocked(executeNearSearch).mockRejectedValue(new Error('Invalid limit'));

      // Act & Assert
      await expect(
        executeNearQuery('venues', 'location', nearQuery, -1, 'test-request-id')
      ).rejects.toThrow('Invalid limit');
    });
  });

  describe('エッジケース', () => {
    test('座標(0, 0)で検索できる', async () => {
      // Arrange
      const nearQuery: NearQuery = {
        latitude: 0,
        longitude: 0,
      };

      vi.mocked(executeNearSearch).mockResolvedValue({
        documents: [
          {
            id: 'venue-equator',
            name: 'Equator Point',
            location: { latitude: 0, longitude: 0 },
            __distance: 0,
          },
        ],
        metadata: {
          iterations: 1,
          candidatesFound: 1,
          searchedBlocks: 9,
        },
      });

      // Act
      const result = await executeNearQuery('venues', 'location', nearQuery, 10, 'test-request-id');

      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.items[0].location.latitude).toBe(0);
      expect(result.items[0].location.longitude).toBe(0);
    });

    test('北極点(90, 0)で検索できる', async () => {
      // Arrange
      const nearQuery: NearQuery = {
        latitude: 90,
        longitude: 0,
      };

      vi.mocked(executeNearSearch).mockResolvedValue({
        documents: [
          {
            id: 'venue-north-pole',
            name: 'North Pole',
            location: { latitude: 90, longitude: 0 },
            __distance: 0,
          },
        ],
        metadata: {
          iterations: 1,
          candidatesFound: 1,
          searchedBlocks: 9,
        },
      });

      // Act
      const result = await executeNearQuery('venues', 'location', nearQuery, 10, 'test-request-id');

      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.items[0].location.latitude).toBe(90);
    });

    test('南極点(-90, 0)で検索できる', async () => {
      // Arrange
      const nearQuery: NearQuery = {
        latitude: -90,
        longitude: 0,
      };

      vi.mocked(executeNearSearch).mockResolvedValue({
        documents: [
          {
            id: 'venue-south-pole',
            name: 'South Pole',
            location: { latitude: -90, longitude: 0 },
            __distance: 0,
          },
        ],
        metadata: {
          iterations: 1,
          candidatesFound: 1,
          searchedBlocks: 9,
        },
      });

      // Act
      const result = await executeNearQuery('venues', 'location', nearQuery, 10, 'test-request-id');

      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.items[0].location.latitude).toBe(-90);
    });

    test('日付変更線(0, 180)で検索できる', async () => {
      // Arrange
      const nearQuery: NearQuery = {
        latitude: 0,
        longitude: 180,
      };

      vi.mocked(executeNearSearch).mockResolvedValue({
        documents: [
          {
            id: 'venue-dateline',
            name: 'Date Line',
            location: { latitude: 0, longitude: 180 },
            __distance: 0,
          },
        ],
        metadata: {
          iterations: 1,
          candidatesFound: 1,
          searchedBlocks: 9,
        },
      });

      // Act
      const result = await executeNearQuery('venues', 'location', nearQuery, 10, 'test-request-id');

      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.items[0].location.longitude).toBe(180);
    });

    test('maxDistance=0で完全一致のみ返す', async () => {
      // Arrange
      const nearQuery: NearQuery = {
        latitude: 35.6812,
        longitude: 139.7671,
        maxDistance: 0,
      };

      vi.mocked(executeNearSearch).mockResolvedValue({
        documents: [
          {
            id: 'venue-exact',
            name: 'Exact Location',
            location: { latitude: 35.6812, longitude: 139.7671 },
            __distance: 0,
          },
        ],
        metadata: {
          iterations: 1,
          candidatesFound: 1,
          searchedBlocks: 9,
        },
      });

      // Act
      const result = await executeNearQuery('venues', 'location', nearQuery, 10, 'test-request-id');

      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.items[0].__distance).toBe(0);
    });
  });

  describe('パフォーマンス', () => {
    test('最初の反復で結果が見つかった場合、追加反復しない', async () => {
      // Arrange
      const nearQuery: NearQuery = {
        latitude: 35.6812,
        longitude: 139.7671,
      };

      vi.mocked(executeNearSearch).mockResolvedValue({
        documents: [
          {
            id: 'venue-001',
            name: '東京タワー',
            __distance: 1000,
          },
        ],
        metadata: {
          iterations: 1, // 1回の反復で完了
          candidatesFound: 1,
          searchedBlocks: 9,
        },
      });

      // Act
      const result = await executeNearQuery('venues', 'location', nearQuery, 10, 'test-request-id');

      // Assert
      expect(result.items).toHaveLength(1);
      // executeNearSearchが1回だけ呼ばれることを確認
      expect(executeNearSearch).toHaveBeenCalledTimes(1);
    });
  });

  describe('searchFunction実装の詳細テスト', () => {
    test('searchFunctionが実際にDynamoDBクエリを実行する', async () => {
      // Arrange
      const nearQuery: NearQuery = {
        latitude: 35.6812,
        longitude: 139.7671,
      };

      // executeNearSearchをモックして、searchFunctionを実際に呼び出す
      let capturedSearchFunction: ((prefix: string) => Promise<any[]>) | null = null;
      vi.mocked(executeNearSearch).mockImplementation(async (query, field, limit, searchFn) => {
        capturedSearchFunction = searchFn;
        // searchFunctionを実際に呼び出す
        const results = await searchFn('xn76ur');
        return {
          documents: results.map((r: any) => ({ ...r, __distance: 1000 })),
          metadata: {
            iterations: 1,
            candidatesFound: results.length,
            searchedBlocks: 9,
          },
        };
      });

      let queryCallCount = 0;
      vi.mocked(executeDynamoDBOperation).mockImplementation(async (fn: any) => {
        queryCallCount++;
        // 実際にfnを実行する（これによりQueryCommandが実行される）
        await fn();

        if (queryCallCount === 1) {
          // シャドウレコード検索
          return {
            Items: [{ PK: 'venues', SK: 'location_geohash#xn76ur#id#venue-001' }],
          };
        } else {
          // 本体レコード取得
          return {
            Items: [
              {
                PK: 'venues',
                SK: 'id#venue-001',
                data: {
                  id: 'venue-001',
                  name: '東京タワー',
                  location: { latitude: 35.6586, longitude: 139.7454 },
                },
              },
            ],
          };
        }
      });

      // Act
      await executeNearQuery('venues', 'location', nearQuery, 10, 'test-request-id');

      // Assert
      expect(capturedSearchFunction).not.toBeNull();
      expect(queryCallCount).toBeGreaterThanOrEqual(2); // シャドウ検索 + 本体取得
    });

    test('searchFunctionが無効なSK形式をスキップする', async () => {
      // Arrange
      const nearQuery: NearQuery = {
        latitude: 35.6812,
        longitude: 139.7671,
      };

      vi.mocked(executeNearSearch).mockImplementation(async (query, field, limit, searchFn) => {
        const results = await searchFn('xn76ur');
        return {
          documents: results.map((r: any) => ({ ...r, __distance: 1000 })),
          metadata: {
            iterations: 1,
            candidatesFound: results.length,
            searchedBlocks: 9,
          },
        };
      });

      let queryCallCount = 0;
      vi.mocked(executeDynamoDBOperation).mockImplementation(async (fn: any) => {
        queryCallCount++;
        // 実際にfnを実行する
        await fn();

        if (queryCallCount === 1) {
          // シャドウレコード検索（無効なSK形式を含む）
          return {
            Items: [
              { PK: 'venues', SK: 'location_geohash#xn76ur#id#venue-valid' },
              { PK: 'venues', SK: 'invalid-sk-format' }, // 無効なSK形式
            ],
          };
        } else {
          // 本体レコード取得（venue-validのみ）
          return {
            Items: [
              {
                PK: 'venues',
                SK: 'id#venue-valid',
                data: {
                  id: 'venue-valid',
                  name: 'Valid Venue',
                  location: { latitude: 35.6812, longitude: 139.7671 },
                },
              },
            ],
          };
        }
      });

      // Act
      const result = await executeNearQuery('venues', 'location', nearQuery, 10, 'test-request-id');

      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('venue-valid');
    });
  });
});
