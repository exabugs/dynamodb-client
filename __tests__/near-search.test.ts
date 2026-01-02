/**
 * $near検索のテスト
 */
import { describe, expect, it } from 'vitest';

import { detectNearQuery } from '../src/server/operations/find/utils.js';
import { executeNearSearch } from '../src/server/query/nearSearch.js';
import type { NearQuery } from '../src/shared/geohash/types.js';

describe('detectNearQuery', () => {
  describe('$nearオペレータの検出', () => {
    it('簡易形式の$nearクエリを検出できる', () => {
      const filter = {
        location: {
          $near: {
            latitude: 35.6812,
            longitude: 139.7671,
            maxDistance: 5000,
          },
        },
      };

      const result = detectNearQuery(filter);

      expect(result).not.toBeNull();
      expect(result?.fieldName).toBe('location');
      expect(result?.nearQuery).toEqual({
        latitude: 35.6812,
        longitude: 139.7671,
        maxDistance: 5000,
      });
    });

    it('GeoJSON形式の$nearクエリを検出できる', () => {
      const filter = {
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [139.7671, 35.6812],
            },
            $maxDistance: 5000,
          },
        },
      };

      const result = detectNearQuery(filter);

      expect(result).not.toBeNull();
      expect(result?.fieldName).toBe('location');
      expect(result?.nearQuery).toEqual({
        $geometry: {
          type: 'Point',
          coordinates: [139.7671, 35.6812],
        },
        $maxDistance: 5000,
      });
    });

    it('$nearオペレータがない場合はnullを返す', () => {
      const filter = {
        status: 'active',
        priority: { $gte: 5 },
      };

      const result = detectNearQuery(filter);

      expect(result).toBeNull();
    });

    it('空のフィルターの場合はnullを返す', () => {
      const result = detectNearQuery({});
      expect(result).toBeNull();
    });

    it('undefinedの場合はnullを返す', () => {
      const result = detectNearQuery(undefined);
      expect(result).toBeNull();
    });

    it('複数フィールドがある場合、最初の$nearを検出する', () => {
      const filter = {
        status: 'active',
        location: {
          $near: {
            latitude: 35.6812,
            longitude: 139.7671,
            maxDistance: 5000,
          },
        },
      };

      const result = detectNearQuery(filter);

      expect(result).not.toBeNull();
      expect(result?.fieldName).toBe('location');
    });
  });
});

describe('executeNearSearch', () => {
  describe('9ブロック検索', () => {
    it('簡易形式のクエリで近隣検索を実行できる', async () => {
      const nearQuery: NearQuery = {
        latitude: 35.6812,
        longitude: 139.7671,
        maxDistance: 5000,
      };

      // モックデータ
      const mockVenues = [
        {
          id: 'venue-1',
          name: '東京タワー',
          location: { latitude: 35.6586, longitude: 139.7454 },
        },
        {
          id: 'venue-2',
          name: '東京スカイツリー',
          location: { latitude: 35.7101, longitude: 139.8107 },
        },
        {
          id: 'venue-3',
          name: '皇居',
          location: { latitude: 35.6852, longitude: 139.7528 },
        },
      ];

      // モック検索関数
      const searchFunction = async (geohashPrefix: string) => {
        // すべてのvenueを返す（実際のDynamoDB検索をシミュレート）
        return mockVenues;
      };

      const result = await executeNearSearch(nearQuery, 'location', 10, searchFunction);

      // 結果の検証
      expect(result.documents).toBeDefined();
      expect(result.documents.length).toBeGreaterThan(0);
      expect(result.documents.length).toBeLessThanOrEqual(10);

      // 距離情報が付与されていることを確認
      result.documents.forEach((doc) => {
        expect(doc.__distance).toBeDefined();
        expect(typeof doc.__distance).toBe('number');
        expect(doc.__distance).toBeGreaterThanOrEqual(0);
      });

      // 距離でソートされていることを確認
      for (let i = 1; i < result.documents.length; i++) {
        expect(result.documents[i].__distance!).toBeGreaterThanOrEqual(
          result.documents[i - 1].__distance!
        );
      }

      // メタデータの検証
      expect(result.metadata.iterations).toBeGreaterThan(0);
      expect(result.metadata.candidatesFound).toBeGreaterThanOrEqual(result.documents.length);
      expect(result.metadata.requestedLimit).toBe(10);
    });

    it('maxDistanceでフィルタリングできる', async () => {
      const nearQuery: NearQuery = {
        latitude: 35.6812,
        longitude: 139.7671,
        maxDistance: 1000, // 1km以内
      };

      const mockVenues = [
        {
          id: 'venue-1',
          name: '近い場所',
          location: { latitude: 35.682, longitude: 139.768 }, // 約100m
        },
        {
          id: 'venue-2',
          name: '遠い場所',
          location: { latitude: 35.7101, longitude: 139.8107 }, // 約5km
        },
      ];

      const searchFunction = async () => mockVenues;

      const result = await executeNearSearch(nearQuery, 'location', 10, searchFunction);

      // maxDistance内の結果のみが返されることを確認
      result.documents.forEach((doc) => {
        expect(doc.__distance!).toBeLessThanOrEqual(1000);
      });
    });

    it('minDistanceでフィルタリングできる', async () => {
      const nearQuery: NearQuery = {
        latitude: 35.6812,
        longitude: 139.7671,
        minDistance: 1000, // 1km以上
      };

      const mockVenues = [
        {
          id: 'venue-1',
          name: '近い場所',
          location: { latitude: 35.682, longitude: 139.768 }, // 約100m
        },
        {
          id: 'venue-2',
          name: '遠い場所',
          location: { latitude: 35.7101, longitude: 139.8107 }, // 約5km
        },
      ];

      const searchFunction = async () => mockVenues;

      const result = await executeNearSearch(nearQuery, 'location', 10, searchFunction);

      // minDistance以上の結果のみが返されることを確認
      result.documents.forEach((doc) => {
        expect(doc.__distance!).toBeGreaterThanOrEqual(1000);
      });
    });

    it('limitで結果数を制限できる', async () => {
      const nearQuery: NearQuery = {
        latitude: 35.6812,
        longitude: 139.7671,
      };

      const mockVenues = Array.from({ length: 20 }, (_, i) => ({
        id: `venue-${i}`,
        name: `Venue ${i}`,
        location: {
          latitude: 35.6812 + i * 0.001,
          longitude: 139.7671 + i * 0.001,
        },
      }));

      const searchFunction = async () => mockVenues;

      const result = await executeNearSearch(
        nearQuery,
        'location',
        5, // limit = 5
        searchFunction
      );

      // 結果が5件以下であることを確認
      expect(result.documents.length).toBeLessThanOrEqual(5);
    });

    it('地理座標がないドキュメントはスキップされる', async () => {
      const nearQuery: NearQuery = {
        latitude: 35.6812,
        longitude: 139.7671,
      };

      const mockVenues = [
        {
          id: 'venue-1',
          name: '正常な場所',
          location: { latitude: 35.682, longitude: 139.768 },
        },
        {
          id: 'venue-2',
          name: '座標なし',
          // locationフィールドなし
        },
        {
          id: 'venue-3',
          name: '不正な座標',
          location: { latitude: 'invalid', longitude: 139.768 },
        },
      ];

      const searchFunction = async () => mockVenues;

      const result = await executeNearSearch(nearQuery, 'location', 10, searchFunction);

      // 正常な座標を持つドキュメントのみが返されることを確認
      expect(result.documents.length).toBe(1);
      expect(result.documents[0].id).toBe('venue-1');
    });

    it('DynamoDBレコード構造でlocationフィールドを正しく取得できる', async () => {
      const nearQuery: NearQuery = {
        latitude: 43.068661,
        longitude: 141.350755,
      };

      // 実際のDynamoDBレコード構造を再現
      const mockVenues = [
        {
          PK: 'venues',
          SK: 'id#test-venue-005',
          id: 'test-venue-005',
          name: '中島公園',
          location: {
            latitude: 43.051389,
            longitude: 141.354167,
          },
          status: 'active',
          isTestData: true,
        },
        {
          PK: 'venues',
          SK: 'id#test-venue-010',
          id: 'test-venue-010',
          name: '大通公園',
          location: {
            latitude: 43.060833,
            longitude: 141.356389,
          },
          status: 'active',
          isTestData: true,
        },
      ];

      const searchFunction = async () => mockVenues;

      const result = await executeNearSearch(nearQuery, 'location', 10, searchFunction);

      // locationフィールドが正しく取得され、距離計算が実行されることを確認
      expect(result.documents.length).toBe(2);
      expect(result.documents[0].__distance).toBeDefined();
      expect(result.documents[1].__distance).toBeDefined();

      // 距離でソートされていることを確認
      expect(result.documents[0].__distance!).toBeLessThanOrEqual(result.documents[1].__distance!);

      // 札幌駅から各公園までの距離を確認
      // 大通公園: 約1km、中島公園: 約2km
      expect(result.documents[0].__distance!).toBeGreaterThan(500);
      expect(result.documents[0].__distance!).toBeLessThan(1500);
      expect(result.documents[1].__distance!).toBeGreaterThan(1500);
      expect(result.documents[1].__distance!).toBeLessThan(2500);
    });

    it('DynamoDB内部フィールド（PK, SK）が含まれていてもlocationを取得できる', async () => {
      const nearQuery: NearQuery = {
        latitude: 35.6812,
        longitude: 139.7671,
      };

      // DynamoDB内部フィールドを含むレコード
      const mockVenues = [
        {
          PK: 'venues',
          SK: 'id#venue-001',
          id: 'venue-001',
          name: 'Test Venue',
          location: {
            latitude: 35.682,
            longitude: 139.768,
          },
          __geohash: 'xn76urx6',
          __shadowKeys: ['location#xn76urx6#id#venue-001'],
        },
      ];

      const searchFunction = async () => mockVenues;

      const result = await executeNearSearch(nearQuery, 'location', 10, searchFunction);

      // locationフィールドが正しく取得されることを確認
      expect(result.documents.length).toBe(1);
      expect(result.documents[0].__distance).toBeDefined();
      expect(result.documents[0].location).toEqual({
        latitude: 35.682,
        longitude: 139.768,
      });
    });

    it('GeoJSON形式のクエリで検索できる', async () => {
      const nearQuery: NearQuery = {
        $geometry: {
          type: 'Point',
          coordinates: [139.7671, 35.6812], // [経度, 緯度]
        },
        $maxDistance: 5000,
      };

      const mockVenues = [
        {
          id: 'venue-1',
          name: '東京タワー',
          location: { latitude: 35.6586, longitude: 139.7454 },
        },
      ];

      const searchFunction = async () => mockVenues;

      const result = await executeNearSearch(nearQuery, 'location', 10, searchFunction);

      expect(result.documents.length).toBeGreaterThan(0);
      expect(result.documents[0].__distance).toBeDefined();
    });
  });

  describe('段階的精度緩和', () => {
    it('候補が不足している場合、精度を緩和して再検索する', async () => {
      const nearQuery: NearQuery = {
        latitude: 35.6812,
        longitude: 139.7671,
      };

      let searchCount = 0;
      const searchFunction = async (geohashPrefix: string) => {
        searchCount++;
        // 最初の検索では結果なし、2回目以降で結果を返す
        if (searchCount === 1) {
          return [];
        }
        return [
          {
            id: 'venue-1',
            name: 'Venue 1',
            location: { latitude: 35.682, longitude: 139.768 },
          },
        ];
      };

      const result = await executeNearSearch(nearQuery, 'location', 10, searchFunction);

      // 複数回検索が実行されたことを確認
      expect(result.metadata.iterations).toBeGreaterThan(1);
    });
  });
});
