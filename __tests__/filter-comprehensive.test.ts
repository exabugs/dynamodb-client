/**
 * filter.tsの包括的なテスト
 * カバレッジ目標: 90%以上
 */
import { describe, expect, test } from 'vitest';

import type { FilterOperator, FilterType, ParsedFilterField } from '../src/server/utils/filter.js';
import {
  applyFilterExpression,
  buildFilterExpression,
  combineFilters,
  convertType,
  createShadowExclusionFilter,
  findOptimizableFilter,
  matchesAllFilters,
  matchesFilter,
  parseFilterField,
} from '../src/server/utils/filter.js';

describe('filter.ts - 包括的テスト', () => {
  describe('parseFilterField - 追加テスト', () => {
    test('$near演算子をパースできる', () => {
      const result = parseFilterField('location:$near');
      expect(result).toEqual({
        field: 'location',
        operator: '$near',
        type: 'string',
      });
    });

    test('$near演算子に型指定できる', () => {
      const result = parseFilterField('location:$near:string');
      expect(result).toEqual({
        field: 'location',
        operator: '$near',
        type: 'string',
      });
    });
  });

  describe('convertType', () => {
    describe('string型への変換', () => {
      test('数値を文字列に変換できる', () => {
        expect(convertType(123, 'string')).toBe('123');
      });

      test('boolean値を文字列に変換できる', () => {
        expect(convertType(true, 'string')).toBe('true');
        expect(convertType(false, 'string')).toBe('false');
      });

      test('文字列はそのまま返す', () => {
        expect(convertType('hello', 'string')).toBe('hello');
      });
    });

    describe('number型への変換', () => {
      test('文字列を数値に変換できる', () => {
        expect(convertType('123', 'number')).toBe(123);
        expect(convertType('123.45', 'number')).toBe(123.45);
      });

      test('数値はそのまま返す', () => {
        expect(convertType(456, 'number')).toBe(456);
      });

      test('無効な文字列はNaNになる', () => {
        expect(convertType('invalid', 'number')).toBeNaN();
      });
    });

    describe('date型への変換', () => {
      test('ISO 8601形式の文字列をDateに変換できる', () => {
        const result = convertType('2024-01-01T00:00:00Z', 'date');
        expect(result).toBeInstanceOf(Date);
        expect((result as Date).toISOString()).toBe('2024-01-01T00:00:00.000Z');
      });

      test('日付文字列をDateに変換できる', () => {
        const result = convertType('2024-01-01', 'date');
        expect(result).toBeInstanceOf(Date);
      });

      test('数値（タイムスタンプ）をDateに変換できる', () => {
        const timestamp = 1704067200000; // 2024-01-01 00:00:00 UTC
        const result = convertType(timestamp, 'date');
        expect(result).toBeInstanceOf(Date);
      });
    });

    describe('boolean型への変換', () => {
      test('文字列"true"をtrueに変換できる', () => {
        expect(convertType('true', 'boolean')).toBe(true);
        expect(convertType('TRUE', 'boolean')).toBe(true);
        expect(convertType('True', 'boolean')).toBe(true);
      });

      test('文字列"false"をfalseに変換できる', () => {
        expect(convertType('false', 'boolean')).toBe(false);
        expect(convertType('FALSE', 'boolean')).toBe(false);
        expect(convertType('False', 'boolean')).toBe(false);
      });

      test('boolean値はそのまま返す', () => {
        expect(convertType(true, 'boolean')).toBe(true);
        expect(convertType(false, 'boolean')).toBe(false);
      });

      test('その他の文字列はfalseになる', () => {
        expect(convertType('yes', 'boolean')).toBe(false);
        expect(convertType('no', 'boolean')).toBe(false);
        expect(convertType('1', 'boolean')).toBe(false);
        expect(convertType('0', 'boolean')).toBe(false);
      });
    });
  });

  describe('matchesFilter', () => {
    describe('$eq演算子', () => {
      test('等価比較（string）', () => {
        const record = { status: 'active' };
        const parsed: ParsedFilterField = { field: 'status', operator: '$eq', type: 'string' };
        expect(matchesFilter(record, parsed, 'active')).toBe(true);
        expect(matchesFilter(record, parsed, 'inactive')).toBe(false);
      });

      test('等価比較（number）', () => {
        const record = { priority: 5 };
        const parsed: ParsedFilterField = { field: 'priority', operator: '$eq', type: 'number' };
        expect(matchesFilter(record, parsed, 5)).toBe(true);
        expect(matchesFilter(record, parsed, '5')).toBe(true); // 型変換される
        expect(matchesFilter(record, parsed, 10)).toBe(false);
      });

      test('等価比較（boolean）', () => {
        const record = { active: true };
        const parsed: ParsedFilterField = { field: 'active', operator: '$eq', type: 'boolean' };
        expect(matchesFilter(record, parsed, true)).toBe(true);
        expect(matchesFilter(record, parsed, 'true')).toBe(true); // 型変換される
        expect(matchesFilter(record, parsed, false)).toBe(false);
      });
    });

    describe('比較演算子', () => {
      test('$lt演算子（number）', () => {
        const record = { priority: 5 };
        const parsed: ParsedFilterField = { field: 'priority', operator: '$lt', type: 'number' };
        expect(matchesFilter(record, parsed, 10)).toBe(true);
        expect(matchesFilter(record, parsed, 5)).toBe(false);
        expect(matchesFilter(record, parsed, 3)).toBe(false);
      });

      test('$lte演算子（number）', () => {
        const record = { priority: 5 };
        const parsed: ParsedFilterField = { field: 'priority', operator: '$lte', type: 'number' };
        expect(matchesFilter(record, parsed, 10)).toBe(true);
        expect(matchesFilter(record, parsed, 5)).toBe(true);
        expect(matchesFilter(record, parsed, 3)).toBe(false);
      });

      test('$gt演算子（number）', () => {
        const record = { priority: 5 };
        const parsed: ParsedFilterField = { field: 'priority', operator: '$gt', type: 'number' };
        expect(matchesFilter(record, parsed, 3)).toBe(true);
        expect(matchesFilter(record, parsed, 5)).toBe(false);
        expect(matchesFilter(record, parsed, 10)).toBe(false);
      });

      test('$gte演算子（number）', () => {
        const record = { priority: 5 };
        const parsed: ParsedFilterField = { field: 'priority', operator: '$gte', type: 'number' };
        expect(matchesFilter(record, parsed, 3)).toBe(true);
        expect(matchesFilter(record, parsed, 5)).toBe(true);
        expect(matchesFilter(record, parsed, 10)).toBe(false);
      });

      test('$lt演算子（date）', () => {
        const record = { createdAt: '2024-01-15' };
        const parsed: ParsedFilterField = { field: 'createdAt', operator: '$lt', type: 'date' };
        expect(matchesFilter(record, parsed, '2024-01-20')).toBe(true);
        expect(matchesFilter(record, parsed, '2024-01-10')).toBe(false);
      });
    });

    describe('文字列演算子', () => {
      test('$starts演算子', () => {
        const record = { name: 'Hello World' };
        const parsed: ParsedFilterField = { field: 'name', operator: '$starts', type: 'string' };
        expect(matchesFilter(record, parsed, 'Hello')).toBe(true);
        expect(matchesFilter(record, parsed, 'World')).toBe(false);
      });

      test('$ends演算子', () => {
        const record = { name: 'Hello World' };
        const parsed: ParsedFilterField = { field: 'name', operator: '$ends', type: 'string' };
        expect(matchesFilter(record, parsed, 'World')).toBe(true);
        expect(matchesFilter(record, parsed, 'Hello')).toBe(false);
      });
    });

    describe('フィールドが存在しない場合', () => {
      test('undefinedの場合はfalseを返す', () => {
        const record = { status: 'active' };
        const parsed: ParsedFilterField = { field: 'priority', operator: '$eq', type: 'number' };
        expect(matchesFilter(record, parsed, 5)).toBe(false);
      });

      test('nullの場合はfalseを返す', () => {
        const record = { status: null };
        const parsed: ParsedFilterField = { field: 'status', operator: '$eq', type: 'string' };
        expect(matchesFilter(record, parsed, 'active')).toBe(false);
      });
    });

    describe('未サポートの演算子', () => {
      test('$ne演算子はfalseを返す（未実装）', () => {
        const record = { status: 'active' };
        const parsed: ParsedFilterField = { field: 'status', operator: '$ne', type: 'string' };
        expect(matchesFilter(record, parsed, 'inactive')).toBe(false);
      });

      test('$in演算子はfalseを返す（未実装）', () => {
        const record = { status: 'active' };
        const parsed: ParsedFilterField = { field: 'status', operator: '$in', type: 'string' };
        expect(matchesFilter(record, parsed, ['active', 'pending'])).toBe(false);
      });

      test('$contains演算子はfalseを返す（未実装）', () => {
        const record = { name: 'Hello World' };
        const parsed: ParsedFilterField = { field: 'name', operator: '$contains', type: 'string' };
        expect(matchesFilter(record, parsed, 'llo')).toBe(false);
      });
    });
  });

  describe('matchesAllFilters', () => {
    test('すべてのフィルターに一致する場合trueを返す', () => {
      const record = { status: 'active', priority: 5 };
      const parsedFilters = [
        {
          parsed: {
            field: 'status',
            operator: '$eq' as FilterOperator,
            type: 'string' as FilterType,
          },
          value: 'active',
        },
        {
          parsed: {
            field: 'priority',
            operator: '$gte' as FilterOperator,
            type: 'number' as FilterType,
          },
          value: 3,
        },
      ];
      expect(matchesAllFilters(record, parsedFilters)).toBe(true);
    });

    test('1つでも一致しない場合falseを返す', () => {
      const record = { status: 'active', priority: 5 };
      const parsedFilters = [
        {
          parsed: {
            field: 'status',
            operator: '$eq' as FilterOperator,
            type: 'string' as FilterType,
          },
          value: 'active',
        },
        {
          parsed: {
            field: 'priority',
            operator: '$gt' as FilterOperator,
            type: 'number' as FilterType,
          },
          value: 10,
        },
      ];
      expect(matchesAllFilters(record, parsedFilters)).toBe(false);
    });

    test('空のフィルター配列の場合trueを返す', () => {
      const record = { status: 'active' };
      expect(matchesAllFilters(record, [])).toBe(true);
    });

    test('複数のオペレータが混在する場合に正しく評価できる', () => {
      const record = { status: 'active', priority: 5, name: 'Task 1' };
      const parsedFilters = [
        {
          parsed: {
            field: 'status',
            operator: '$eq' as FilterOperator,
            type: 'string' as FilterType,
          },
          value: 'active',
        },
        {
          parsed: {
            field: 'priority',
            operator: '$gte' as FilterOperator,
            type: 'number' as FilterType,
          },
          value: 3,
        },
        {
          parsed: {
            field: 'name',
            operator: '$starts' as FilterOperator,
            type: 'string' as FilterType,
          },
          value: 'Task',
        },
      ];
      expect(matchesAllFilters(record, parsedFilters)).toBe(true);
    });
  });

  describe('createShadowExclusionFilter', () => {
    test('シャドーレコード除外フィルターを生成できる', () => {
      const result = createShadowExclusionFilter();
      expect(result.expression).toBe(
        'attribute_exists(#data) AND NOT contains(#sk, :shadowMarker)'
      );
      expect(result.names).toEqual({
        '#data': 'data',
        '#sk': 'SK',
      });
      expect(result.values).toEqual({
        ':shadowMarker': '#id#',
      });
    });
  });

  describe('buildFilterExpression', () => {
    test('単一フィールドのフィルター式を構築できる', () => {
      const filter = { status: 'active' };
      const result = buildFilterExpression(filter);
      expect(result).not.toBeNull();
      expect(result!.expression).toBe('#data.#field0 = :value0');
      expect(result!.names).toEqual({
        '#data': 'data',
        '#field0': 'status',
      });
      expect(result!.values).toEqual({
        ':value0': 'active',
      });
    });

    test('複数フィールドのフィルター式を構築できる', () => {
      const filter = { status: 'active', priority: 5 };
      const result = buildFilterExpression(filter);
      expect(result).not.toBeNull();
      expect(result!.expression).toBe('#data.#field0 = :value0 AND #data.#field1 = :value1');
      expect(result!.names).toEqual({
        '#data': 'data',
        '#field0': 'status',
        '#field1': 'priority',
      });
      expect(result!.values).toEqual({
        ':value0': 'active',
        ':value1': 5,
      });
    });

    test('空のフィルターの場合nullを返す', () => {
      const filter = {};
      const result = buildFilterExpression(filter);
      expect(result).toBeNull();
    });
  });

  describe('combineFilters', () => {
    test('単一フィルターの場合そのまま返す', () => {
      const filter = {
        expression: '#data.#field0 = :value0',
        names: { '#data': 'data', '#field0': 'status' },
        values: { ':value0': 'active' },
      };
      const result = combineFilters([filter]);
      expect(result).toEqual(filter);
    });

    test('複数フィルターをAND条件で結合できる', () => {
      const filter1 = {
        expression: '#data.#field0 = :value0',
        names: { '#data': 'data', '#field0': 'status' },
        values: { ':value0': 'active' },
      };
      const filter2 = {
        expression: '#data.#field1 >= :value1',
        names: { '#data': 'data', '#field1': 'priority' },
        values: { ':value1': 5 },
      };
      const result = combineFilters([filter1, filter2]);
      expect(result).not.toBeNull();
      expect(result!.expression).toBe('(#data.#field0 = :value0) AND (#data.#field1 >= :value1)');
      expect(result!.names).toEqual({
        '#data': 'data',
        '#field0': 'status',
        '#field1': 'priority',
      });
      expect(result!.values).toEqual({
        ':value0': 'active',
        ':value1': 5,
      });
    });

    test('nullを含むフィルター配列を処理できる', () => {
      const filter = {
        expression: '#data.#field0 = :value0',
        names: { '#data': 'data', '#field0': 'status' },
        values: { ':value0': 'active' },
      };
      const result = combineFilters([null, filter, null]);
      expect(result).toEqual(filter);
    });

    test('すべてnullの場合nullを返す', () => {
      const result = combineFilters([null, null]);
      expect(result).toBeNull();
    });

    test('空配列の場合nullを返す', () => {
      const result = combineFilters([]);
      expect(result).toBeNull();
    });
  });

  describe('applyFilterExpression', () => {
    test('フィルター式をパラメータに適用できる', () => {
      const params = {
        TableName: 'test-table',
        KeyConditionExpression: 'PK = :pk',
      };
      const filter = {
        expression: '#data.#field0 = :value0',
        names: { '#data': 'data', '#field0': 'status' },
        values: { ':value0': 'active' },
      };
      const result = applyFilterExpression(params, filter);
      expect(result).toEqual({
        TableName: 'test-table',
        KeyConditionExpression: 'PK = :pk',
        FilterExpression: '#data.#field0 = :value0',
        ExpressionAttributeNames: {
          '#data': 'data',
          '#field0': 'status',
        },
        ExpressionAttributeValues: {
          ':value0': 'active',
        },
      });
    });

    test('既存のExpressionAttributeNamesとマージできる', () => {
      const params = {
        TableName: 'test-table',
        ExpressionAttributeNames: {
          '#pk': 'PK',
        },
      };
      const filter = {
        expression: '#data.#field0 = :value0',
        names: { '#data': 'data', '#field0': 'status' },
        values: { ':value0': 'active' },
      };
      const result = applyFilterExpression(params, filter);
      expect(result.ExpressionAttributeNames).toEqual({
        '#pk': 'PK',
        '#data': 'data',
        '#field0': 'status',
      });
    });

    test('既存のExpressionAttributeValuesとマージできる', () => {
      const params = {
        TableName: 'test-table',
        ExpressionAttributeValues: {
          ':pk': 'test-pk',
        },
      };
      const filter = {
        expression: '#data.#field0 = :value0',
        names: { '#data': 'data', '#field0': 'status' },
        values: { ':value0': 'active' },
      };
      const result = applyFilterExpression(params, filter);
      expect(result.ExpressionAttributeValues).toEqual({
        ':pk': 'test-pk',
        ':value0': 'active',
      });
    });

    test('フィルターがnullの場合パラメータをそのまま返す', () => {
      const params = {
        TableName: 'test-table',
        KeyConditionExpression: 'PK = :pk',
      };
      const result = applyFilterExpression(params, null);
      expect(result).toEqual(params);
    });
  });

  describe('findOptimizableFilter', () => {
    test('ソートフィールドと一致する$eq演算子を検出できる', () => {
      const parsedFilters = [
        {
          parsed: {
            field: 'status',
            operator: '$eq' as FilterOperator,
            type: 'string' as FilterType,
          },
          value: 'active',
        },
      ];
      const result = findOptimizableFilter('status', parsedFilters);
      expect(result).toEqual(parsedFilters[0]);
    });

    test('ソートフィールドと一致する$starts演算子を検出できる', () => {
      const parsedFilters = [
        {
          parsed: {
            field: 'name',
            operator: '$starts' as FilterOperator,
            type: 'string' as FilterType,
          },
          value: 'Task',
        },
      ];
      const result = findOptimizableFilter('name', parsedFilters);
      expect(result).toEqual(parsedFilters[0]);
    });

    test('ソートフィールドと一致する比較演算子を検出できる', () => {
      const parsedFilters = [
        {
          parsed: {
            field: 'priority',
            operator: '$gte' as FilterOperator,
            type: 'number' as FilterType,
          },
          value: 5,
        },
      ];
      const result = findOptimizableFilter('priority', parsedFilters);
      expect(result).toEqual(parsedFilters[0]);
    });

    test('ソートフィールドと一致しない場合nullを返す', () => {
      const parsedFilters = [
        {
          parsed: {
            field: 'status',
            operator: '$eq' as FilterOperator,
            type: 'string' as FilterType,
          },
          value: 'active',
        },
      ];
      const result = findOptimizableFilter('priority', parsedFilters);
      expect(result).toBeNull();
    });

    test('Query不可能な演算子の場合nullを返す', () => {
      const parsedFilters = [
        {
          parsed: {
            field: 'status',
            operator: '$ne' as FilterOperator,
            type: 'string' as FilterType,
          },
          value: 'inactive',
        },
      ];
      const result = findOptimizableFilter('status', parsedFilters);
      expect(result).toBeNull();
    });

    test('複数フィルターから最初の最適化可能なものを返す', () => {
      const parsedFilters = [
        {
          parsed: {
            field: 'status',
            operator: '$ne' as FilterOperator,
            type: 'string' as FilterType,
          },
          value: 'inactive',
        },
        {
          parsed: {
            field: 'priority',
            operator: '$gte' as FilterOperator,
            type: 'number' as FilterType,
          },
          value: 5,
        },
        {
          parsed: {
            field: 'priority',
            operator: '$lt' as FilterOperator,
            type: 'number' as FilterType,
          },
          value: 10,
        },
      ];
      const result = findOptimizableFilter('priority', parsedFilters);
      expect(result).toEqual(parsedFilters[1]);
    });

    test('空のフィルター配列の場合nullを返す', () => {
      const result = findOptimizableFilter('status', []);
      expect(result).toBeNull();
    });
  });
});
