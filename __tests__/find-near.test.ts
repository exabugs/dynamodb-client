/**
 * find操作での$near検索の統合テスト
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { handleFind } from '../src/server/operations/find/handler.js';
import type { FindParams } from '../src/server/types.js';

// モック設定
let mockDbClient: any;
let mockTableName: string;
let mockQueryResults: any[] = [];

// DynamoDBユーティリティのモック
vi.mock('../src/server/utils/dynamodb.js', () => ({
  getDBClient: () => mockDbClient,
  getTableName: () => mockTableName,
  executeDynamoDBOperation: async (fn: () => Promise<any>) => fn(),
  extractCleanRecord: (item: any) => {
    const { PK, SK, ...rest } = item;
    return rest;
  },
}));

// シャドウ設定のモック
vi.mock('../src/server/shadow/config.js', () => ({
  getShadowConfig: () => ({
    createdAtField: 'createdAt',
    updatedAtField: 'updatedAt',
    stringMaxBytes: 100,
    numberPadding: 15,
  }),
}));

describe('find操作での$near検索', () => {
  beforeEach(() => {
    mockTableName = 'test-table';
    mockQueryResults = [];

    // DynamoDBクライアントのモック
    mockDbClient = {
      send: async (command: any) => {
        // QueryCommandのシミュレーション
        return {
          Items: mockQueryResults,
          LastEvaluatedKey: undefined,
        };
      },
    };
  });

  afterEach(() => {
    mockQueryResults = [];
  });

  describe('$nearオペレータの検出と実行', () => {
    it('簡易形式の$nearクエリでfind操作を実行できる', async () => {
      // モックデータの準備
      mockQueryResults = [
        {
          PK: 'venues',
          SK: 'id#venue-1',
          id: 'venue-1',
          name: '東京タワー',
          location: { latitude: 35.6586, longitude: 139.7454 },
        },
        {
          PK: 'venues',
          SK: 'id#venue-2',
          id: 'venue-2',
          name: '東京スカイツリー',
          location: { latitude: 35.7101, longitude: 139.8107 },
        },
      ];

      const params: FindParams = {
        filter: {
          location: {
            $near: {
              latitude: 35.6812,
              longitude: 139.7671,
              maxDistance: 10000,
            },
          },
        },
        pagination: {
          perPage: 10,
        },
      };

      const result = await handleFind('venues', params, 'test-request-id');

      // 結果の検証
      expect(result.items).toBeDefined();
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.pageInfo).toBeDefined();
      expect(result.pageInfo.hasNextPage).toBe(false);
      expect(result.pageInfo.hasPreviousPage).toBe(false);

      // 距離情報が付与されていることを確認
      if (result.items.length > 0) {
        result.items.forEach((item: any) => {
          expect(item.__distance).toBeDefined();
          expect(typeof item.__distance).toBe('number');
        });
      }
    });

    it('GeoJSON形式の$nearクエリでfind操作を実行できる', async () => {
      mockQueryResults = [
        {
          PK: 'venues',
          SK: 'id#venue-1',
          id: 'venue-1',
          name: '東京タワー',
          location: { latitude: 35.6586, longitude: 139.7454 },
        },
      ];

      const params: FindParams = {
        filter: {
          location: {
            $near: {
              $geometry: {
                type: 'Point',
                coordinates: [139.7671, 35.6812],
              },
              $maxDistance: 10000,
            },
          },
        },
        pagination: {
          perPage: 10,
        },
      };

      const result = await handleFind('venues', params, 'test-request-id');

      expect(result.items).toBeDefined();
      expect(result.pageInfo).toBeDefined();
    });

    it('$nearオペレータがない場合は通常のfind操作を実行する', async () => {
      mockQueryResults = [
        {
          PK: 'venues',
          SK: 'status#active#id#venue-1',
          id: 'venue-1',
          name: 'Venue 1',
          status: 'active',
        },
      ];

      const params: FindParams = {
        filter: {
          status: 'active',
        },
        sort: {
          field: 'status',
          order: 'ASC',
        },
        pagination: {
          perPage: 10,
        },
      };

      const result = await handleFind('venues', params, 'test-request-id');

      expect(result.items).toBeDefined();
      expect(result.pageInfo).toBeDefined();
    });

    it('paginationのperPageが$near検索のlimitとして使用される', async () => {
      mockQueryResults = Array.from({ length: 20 }, (_, i) => ({
        PK: 'venues',
        SK: `id#venue-${i}`,
        id: `venue-${i}`,
        name: `Venue ${i}`,
        location: {
          latitude: 35.6812 + i * 0.001,
          longitude: 139.7671 + i * 0.001,
        },
      }));

      const params: FindParams = {
        filter: {
          location: {
            $near: {
              latitude: 35.6812,
              longitude: 139.7671,
            },
          },
        },
        pagination: {
          perPage: 5,
        },
      };

      const result = await handleFind('venues', params, 'test-request-id');

      // 結果が5件以下であることを確認
      expect(result.items.length).toBeLessThanOrEqual(5);
    });

    it('paginationが指定されていない場合はデフォルトのlimit(10)を使用する', async () => {
      mockQueryResults = Array.from({ length: 20 }, (_, i) => ({
        PK: 'venues',
        SK: `id#venue-${i}`,
        id: `venue-${i}`,
        name: `Venue ${i}`,
        location: {
          latitude: 35.6812 + i * 0.001,
          longitude: 139.7671 + i * 0.001,
        },
      }));

      const params: FindParams = {
        filter: {
          location: {
            $near: {
              latitude: 35.6812,
              longitude: 139.7671,
            },
          },
        },
      };

      const result = await handleFind('venues', params, 'test-request-id');

      // 結果が10件以下であることを確認
      expect(result.items.length).toBeLessThanOrEqual(10);
    });
  });

  describe('エラーハンドリング', () => {
    it('DynamoDBエラーが発生した場合、適切にエラーを伝播する', async () => {
      // エラーを投げるモック
      mockDbClient = {
        send: async () => {
          throw new Error('DynamoDB error');
        },
      };

      const params: FindParams = {
        filter: {
          location: {
            $near: {
              latitude: 35.6812,
              longitude: 139.7671,
            },
          },
        },
      };

      await expect(handleFind('venues', params, 'test-request-id')).rejects.toThrow(
        'DynamoDB error'
      );
    });
  });
});
