/**
 * フィルター処理のテスト
 */
import { describe, expect, it } from 'vitest';

import { parseFilterField } from '../src/server/utils/filter.js';

describe('parseFilterField', () => {
  describe('基本的な演算子', () => {
    it('演算子なし（デフォルトは$eq）', () => {
      const result = parseFilterField('status');
      expect(result).toEqual({
        field: 'status',
        operator: '$eq',
        type: 'string',
      });
    });

    it('$eq演算子', () => {
      const result = parseFilterField('status:$eq');
      expect(result).toEqual({
        field: 'status',
        operator: '$eq',
        type: 'string',
      });
    });

    it('$ne演算子', () => {
      const result = parseFilterField('status:$ne');
      expect(result).toEqual({
        field: 'status',
        operator: '$ne',
        type: 'string',
      });
    });
  });

  describe('比較演算子', () => {
    it('$gt演算子', () => {
      const result = parseFilterField('priority:$gt');
      expect(result).toEqual({
        field: 'priority',
        operator: '$gt',
        type: 'string',
      });
    });

    it('$gte演算子', () => {
      const result = parseFilterField('priority:$gte');
      expect(result).toEqual({
        field: 'priority',
        operator: '$gte',
        type: 'string',
      });
    });

    it('$lt演算子', () => {
      const result = parseFilterField('priority:$lt');
      expect(result).toEqual({
        field: 'priority',
        operator: '$lt',
        type: 'string',
      });
    });

    it('$lte演算子', () => {
      const result = parseFilterField('priority:$lte');
      expect(result).toEqual({
        field: 'priority',
        operator: '$lte',
        type: 'string',
      });
    });
  });

  describe('配列演算子', () => {
    it('$in演算子', () => {
      const result = parseFilterField('id:$in');
      expect(result).toEqual({
        field: 'id',
        operator: '$in',
        type: 'string',
      });
    });

    it('$nin演算子', () => {
      const result = parseFilterField('id:$nin');
      expect(result).toEqual({
        field: 'id',
        operator: '$nin',
        type: 'string',
      });
    });
  });

  describe('文字列演算子', () => {
    it('$starts演算子', () => {
      const result = parseFilterField('name:$starts');
      expect(result).toEqual({
        field: 'name',
        operator: '$starts',
        type: 'string',
      });
    });

    it('$ends演算子', () => {
      const result = parseFilterField('name:$ends');
      expect(result).toEqual({
        field: 'name',
        operator: '$ends',
        type: 'string',
      });
    });

    it('$contains演算子', () => {
      const result = parseFilterField('name:$contains');
      expect(result).toEqual({
        field: 'name',
        operator: '$contains',
        type: 'string',
      });
    });
  });

  describe('存在チェック演算子', () => {
    it('$exists演算子', () => {
      const result = parseFilterField('field:$exists');
      expect(result).toEqual({
        field: 'field',
        operator: '$exists',
        type: 'string',
      });
    });
  });

  describe('型指定', () => {
    it('number型', () => {
      const result = parseFilterField('priority:$gte:number');
      expect(result).toEqual({
        field: 'priority',
        operator: '$gte',
        type: 'number',
      });
    });

    it('date型', () => {
      const result = parseFilterField('createdAt:$gte:date');
      expect(result).toEqual({
        field: 'createdAt',
        operator: '$gte',
        type: 'date',
      });
    });

    it('boolean型', () => {
      const result = parseFilterField('active:$eq:boolean');
      expect(result).toEqual({
        field: 'active',
        operator: '$eq',
        type: 'boolean',
      });
    });
  });

  describe('エラーケース', () => {
    it('$プレフィックスなしの演算子はエラー', () => {
      expect(() => parseFilterField('field:in')).toThrow('Invalid filter operator: in');
    });

    it('無効な演算子', () => {
      expect(() => parseFilterField('field:invalid')).toThrow('Invalid filter operator: invalid');
    });

    it('無効な型', () => {
      expect(() => parseFilterField('field:$eq:invalid')).toThrow('Invalid filter type: invalid');
    });

    it('不正な構文（4つ以上のパーツ）', () => {
      expect(() => parseFilterField('field:$eq:string:extra')).toThrow(
        'Invalid filter field syntax'
      );
    });
  });
});
