/**
 * find/utils.tsの包括的なテスト
 * カバレッジ目標: 90%以上
 */
import { describe, expect, test, vi } from 'vitest';

import type { ParsedFilter } from '../src/server/operations/find/types.js';
import {
  detectNearQuery,
  findOptimizableFilter,
  initializeFindConfig,
  matchesAllFilters,
  normalizeFindParams,
} from '../src/server/operations/find/utils.js';
import type { FindParams } from '../src/server/types.js';
import { ConfigError } from '../src/shared/errors/index.js';
import type { NearQuery } from '../src/shared/geohash/types.js';

// モック
vi.mock('../src/server/shadow/index.js', () => ({
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

vi.mock('../src/server/utils/validation.js', () => ({
  normalizeSort: vi.fn((config, resource, sort) => sort || { field: 'id', order: 'asc' }),
  normalizePagination: vi.fn((pagination) => pagination || { page: 1, perPage: 10 }),
}));

describe('find/utils.ts - 包括的テスト', () => {
  describe('initializeFindConfig', () => {
    test('シャドウ設定を取得できる', () => {
      const config = initializeFindConfig();
      expect(config).toBeDefined();
      expect(config.resources).toBeDefined();
    });
  });

  describe('normalizeFindParams', () => {
    test('基本的なパラメータを正規化できる', () => {
      const config = initializeFindConfig();
      const params: FindParams = {
        sort: { field: 'name', order: 'asc' },
        pagination: { page: 1, perPage: 20 },
        filter: { status: 'active' },
      };

      const result = normalizeFindParams(config, 'venues', params);

      expect(result.sort).toEqual({ field: 'name', order: 'asc' });
      expect(result.pagination).toEqual({ page: 1, perPage: 20 });
      expect(result.parsedFilters).toHaveLength(1);
      expect(result.parsedFilters[0].parsed.field).toBe('status');
      expect(result.parsedFilters[0].value).toBe('active');
    });

    test('フィルターなしのパラメータを正規化できる', () => {
      const config = initializeFindConfig();
      const params: FindParams = {
        sort: { field: 'name', order: 'asc' },
        pagination: { page: 1, perPage: 20 },
      };

      const result = normalizeFindParams(config, 'venues', params);

      expect(result.parsedFilters).toHaveLength(0);
    });

    test('ネストされたオブジェクト形式のフィルターを正規化できる', () => {
      const config = initializeFindConfig();
      const params: FindParams = {
        filter: {
          priority: { $gte: 5 },
        },
      };

      const result = normalizeFindParams(config, 'venues', params);

      expect(result.parsedFilters).toHaveLength(1);
      expect(result.parsedFilters[0].parsed.field).toBe('priority');
      expect(result.parsedFilters[0].parsed.operator).toBe('$gte');
      expect(result.parsedFilters[0].value).toBe(5);
    });

    test('複数の演算子を持つフィルターを正規化できる', () => {
      const config = initializeFindConfig();
      const params: FindParams = {
        filter: {
          priority: { $gte: 5, $lte: 10 },
        },
      };

      const result = normalizeFindParams(config, 'venues', params);

      expect(result.parsedFilters).toHaveLength(2);
      expect(result.parsedFilters[0].parsed.operator).toBe('$gte');
      expect(result.parsedFilters[1].parsed.operator).toBe('$lte');
    });

    test('無効なフィルター構文の場合にConfigErrorを投げる', () => {
      const config = initializeFindConfig();
      const params: FindParams = {
        filter: {
          'field:invalid': 'value',
        },
      };

      expect(() => normalizeFindParams(config, 'venues', params)).toThrow(ConfigError);
    });
  });

  describe('detectNearQuery', () => {
    describe('ネストされたオブジェクト形式', () => {
      test('簡易形式の$nearを検出できる', () => {
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
        expect(result!.fieldName).toBe('location');
        expect(result!.nearQuery).toEqual({
          latitude: 35.6812,
          longitude: 139.7671,
          maxDistance: 5000,
        });
      });

      test('GeoJSON形式の$nearを検出できる', () => {
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
        expect(result!.fieldName).toBe('location');
        expect(result!.nearQuery).toMatchObject({
          $geometry: {
            type: 'Point',
            coordinates: [139.7671, 35.6812],
          },
          $maxDistance: 5000,
        });
      });

      test('複数フィールドがある場合、$nearを持つフィールドを検出できる', () => {
        const filter = {
          status: 'active',
          location: {
            $near: {
              latitude: 35.6812,
              longitude: 139.7671,
            },
          },
          priority: 5,
        };

        const result = detectNearQuery(filter);

        expect(result).not.toBeNull();
        expect(result!.fieldName).toBe('location');
      });
    });

    describe('$nearが存在しない場合', () => {
      test('空のフィルターでnullを返す', () => {
        const result = detectNearQuery({});
        expect(result).toBeNull();
      });

      test('undefinedの場合nullを返す', () => {
        const result = detectNearQuery(undefined);
        expect(result).toBeNull();
      });

      test('他のオペレータのみの場合nullを返す', () => {
        const filter = {
          status: { $eq: 'active' },
          priority: { $gte: 5 },
        };

        const result = detectNearQuery(filter);
        expect(result).toBeNull();
      });

      test('$nearがネストされていない場合nullを返す', () => {
        const filter = {
          location: 'some-value',
        };

        const result = detectNearQuery(filter);
        expect(result).toBeNull();
      });

      test('$nearが配列の場合nullを返す', () => {
        const filter = {
          location: ['value1', 'value2'],
        };

        const result = detectNearQuery(filter);
        expect(result).toBeNull();
      });
    });
  });

  describe('findOptimizableFilter', () => {
    test('ソートフィールドと一致するフィルターを検出できる', () => {
      const parsedFilters: ParsedFilter[] = [
        {
          parsed: { field: 'status', operator: '$eq', type: 'string' },
          value: 'active',
        },
        {
          parsed: { field: 'priority', operator: '$gte', type: 'number' },
          value: 5,
        },
      ];

      const result = findOptimizableFilter('priority', parsedFilters);

      expect(result).toBeDefined();
      expect(result!.parsed.field).toBe('priority');
    });

    test('ソートフィールドと一致しない場合undefinedを返す', () => {
      const parsedFilters: ParsedFilter[] = [
        {
          parsed: { field: 'status', operator: '$eq', type: 'string' },
          value: 'active',
        },
      ];

      const result = findOptimizableFilter('priority', parsedFilters);

      expect(result).toBeUndefined();
    });

    test('空のフィルター配列の場合undefinedを返す', () => {
      const result = findOptimizableFilter('status', []);
      expect(result).toBeUndefined();
    });
  });

  describe('matchesAllFilters', () => {
    describe('基本的な演算子', () => {
      test('$eq演算子でマッチする', () => {
        const record = { status: 'active' };
        const parsedFilters: ParsedFilter[] = [
          {
            parsed: { field: 'status', operator: '$eq', type: 'string' },
            value: 'active',
          },
        ];

        expect(matchesAllFilters(record, parsedFilters)).toBe(true);
      });

      test('$eq演算子でマッチしない', () => {
        const record = { status: 'inactive' };
        const parsedFilters: ParsedFilter[] = [
          {
            parsed: { field: 'status', operator: '$eq', type: 'string' },
            value: 'active',
          },
        ];

        expect(matchesAllFilters(record, parsedFilters)).toBe(false);
      });

      test('$ne演算子でマッチする', () => {
        const record = { status: 'active' };
        const parsedFilters: ParsedFilter[] = [
          {
            parsed: { field: 'status', operator: '$ne', type: 'string' },
            value: 'inactive',
          },
        ];

        expect(matchesAllFilters(record, parsedFilters)).toBe(true);
      });

      test('$ne演算子でマッチしない', () => {
        const record = { status: 'active' };
        const parsedFilters: ParsedFilter[] = [
          {
            parsed: { field: 'status', operator: '$ne', type: 'string' },
            value: 'active',
          },
        ];

        expect(matchesAllFilters(record, parsedFilters)).toBe(false);
      });
    });

    describe('比較演算子', () => {
      test('$gt演算子でマッチする', () => {
        const record = { priority: 10 };
        const parsedFilters: ParsedFilter[] = [
          {
            parsed: { field: 'priority', operator: '$gt', type: 'number' },
            value: 5,
          },
        ];

        expect(matchesAllFilters(record, parsedFilters)).toBe(true);
      });

      test('$gte演算子でマッチする', () => {
        const record = { priority: 5 };
        const parsedFilters: ParsedFilter[] = [
          {
            parsed: { field: 'priority', operator: '$gte', type: 'number' },
            value: 5,
          },
        ];

        expect(matchesAllFilters(record, parsedFilters)).toBe(true);
      });

      test('$lt演算子でマッチする', () => {
        const record = { priority: 3 };
        const parsedFilters: ParsedFilter[] = [
          {
            parsed: { field: 'priority', operator: '$lt', type: 'number' },
            value: 5,
          },
        ];

        expect(matchesAllFilters(record, parsedFilters)).toBe(true);
      });

      test('$lte演算子でマッチする', () => {
        const record = { priority: 5 };
        const parsedFilters: ParsedFilter[] = [
          {
            parsed: { field: 'priority', operator: '$lte', type: 'number' },
            value: 5,
          },
        ];

        expect(matchesAllFilters(record, parsedFilters)).toBe(true);
      });

      test('nullの場合はマッチしない', () => {
        const record = { priority: null };
        const parsedFilters: ParsedFilter[] = [
          {
            parsed: { field: 'priority', operator: '$gt', type: 'number' },
            value: 5,
          },
        ];

        expect(matchesAllFilters(record, parsedFilters)).toBe(false);
      });
    });

    describe('配列演算子', () => {
      test('$in演算子でマッチする', () => {
        const record = { id: 'id1' };
        const parsedFilters: ParsedFilter[] = [
          {
            parsed: { field: 'id', operator: '$in', type: 'string' },
            value: ['id1', 'id2', 'id3'],
          },
        ];

        expect(matchesAllFilters(record, parsedFilters)).toBe(true);
      });

      test('$in演算子でマッチしない', () => {
        const record = { id: 'id4' };
        const parsedFilters: ParsedFilter[] = [
          {
            parsed: { field: 'id', operator: '$in', type: 'string' },
            value: ['id1', 'id2', 'id3'],
          },
        ];

        expect(matchesAllFilters(record, parsedFilters)).toBe(false);
      });

      test('$nin演算子でマッチする', () => {
        const record = { id: 'id4' };
        const parsedFilters: ParsedFilter[] = [
          {
            parsed: { field: 'id', operator: '$nin', type: 'string' },
            value: ['id1', 'id2', 'id3'],
          },
        ];

        expect(matchesAllFilters(record, parsedFilters)).toBe(true);
      });

      test('$nin演算子でマッチしない', () => {
        const record = { id: 'id1' };
        const parsedFilters: ParsedFilter[] = [
          {
            parsed: { field: 'id', operator: '$nin', type: 'string' },
            value: ['id1', 'id2', 'id3'],
          },
        ];

        expect(matchesAllFilters(record, parsedFilters)).toBe(false);
      });
    });

    describe('文字列演算子', () => {
      test('$starts演算子でマッチする', () => {
        const record = { name: 'Hello World' };
        const parsedFilters: ParsedFilter[] = [
          {
            parsed: { field: 'name', operator: '$starts', type: 'string' },
            value: 'Hello',
          },
        ];

        expect(matchesAllFilters(record, parsedFilters)).toBe(true);
      });

      test('$ends演算子でマッチする', () => {
        const record = { name: 'Hello World' };
        const parsedFilters: ParsedFilter[] = [
          {
            parsed: { field: 'name', operator: '$ends', type: 'string' },
            value: 'World',
          },
        ];

        expect(matchesAllFilters(record, parsedFilters)).toBe(true);
      });

      test('$contains演算子でマッチする', () => {
        const record = { name: 'Hello World' };
        const parsedFilters: ParsedFilter[] = [
          {
            parsed: { field: 'name', operator: '$contains', type: 'string' },
            value: 'lo Wo',
          },
        ];

        expect(matchesAllFilters(record, parsedFilters)).toBe(true);
      });
    });

    describe('存在チェック演算子', () => {
      test('$exists演算子（true）でマッチする', () => {
        const record = { field: 'value' };
        const parsedFilters: ParsedFilter[] = [
          {
            parsed: { field: 'field', operator: '$exists', type: 'string' },
            value: true,
          },
        ];

        expect(matchesAllFilters(record, parsedFilters)).toBe(true);
      });

      test('$exists演算子（false）でマッチする', () => {
        const record = { other: 'value' };
        const parsedFilters: ParsedFilter[] = [
          {
            parsed: { field: 'field', operator: '$exists', type: 'string' },
            value: false,
          },
        ];

        expect(matchesAllFilters(record, parsedFilters)).toBe(true);
      });

      test('$exists演算子（true）でnullはマッチしない', () => {
        const record = { field: null };
        const parsedFilters: ParsedFilter[] = [
          {
            parsed: { field: 'field', operator: '$exists', type: 'string' },
            value: true,
          },
        ];

        expect(matchesAllFilters(record, parsedFilters)).toBe(false);
      });
    });

    describe('複数条件（AND）', () => {
      test('すべての条件にマッチする', () => {
        const record = { status: 'active', priority: 10 };
        const parsedFilters: ParsedFilter[] = [
          {
            parsed: { field: 'status', operator: '$eq', type: 'string' },
            value: 'active',
          },
          {
            parsed: { field: 'priority', operator: '$gte', type: 'number' },
            value: 5,
          },
        ];

        expect(matchesAllFilters(record, parsedFilters)).toBe(true);
      });

      test('一部の条件にマッチしない', () => {
        const record = { status: 'inactive', priority: 10 };
        const parsedFilters: ParsedFilter[] = [
          {
            parsed: { field: 'status', operator: '$eq', type: 'string' },
            value: 'active',
          },
          {
            parsed: { field: 'priority', operator: '$gte', type: 'number' },
            value: 5,
          },
        ];

        expect(matchesAllFilters(record, parsedFilters)).toBe(false);
      });

      test('空のフィルター配列の場合trueを返す', () => {
        const record = { status: 'active' };
        expect(matchesAllFilters(record, [])).toBe(true);
      });
    });

    describe('未知の演算子', () => {
      test('未知の演算子の場合trueを返す（デフォルト動作）', () => {
        const record = { status: 'active' };
        const parsedFilters: ParsedFilter[] = [
          {
            parsed: { field: 'status', operator: '$unknown' as any, type: 'string' },
            value: 'active',
          },
        ];

        expect(matchesAllFilters(record, parsedFilters)).toBe(true);
      });
    });
  });
});
