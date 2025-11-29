/**
 * クエリ変換のテスト
 */
import { describe, expect, it } from 'vitest';

import { convertFilterToDynamo } from '../src/server/query/converter.js';
import type { Filter } from '../src/types.js';

interface Product {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  price: number;
  stock: number;
  priority: number;
  createdAt: string;
}

describe('convertFilterToDynamo', () => {
  it('空のフィルタを変換する', () => {
    const filter: Filter<Product> = {};
    const result = convertFilterToDynamo('products', filter);

    expect(result).toEqual({
      pk: 'products',
      conditions: [],
    });
  });

  it('単純な等価条件を変換する', () => {
    const filter: Filter<Product> = { status: 'active' };
    const result = convertFilterToDynamo('products', filter);

    expect(result).toEqual({
      pk: 'products',
      conditions: [
        {
          field: 'status',
          operator: 'eq',
          value: 'active',
        },
      ],
    });
  });

  it('複数の等価条件を変換する', () => {
    const filter: Filter<Product> = {
      status: 'active',
      name: 'Product 1',
    };
    const result = convertFilterToDynamo('products', filter);

    expect(result.pk).toBe('products');
    expect(result.conditions).toHaveLength(2);
    expect(result.conditions).toContainEqual({
      field: 'status',
      operator: 'eq',
      value: 'active',
    });
    expect(result.conditions).toContainEqual({
      field: 'name',
      operator: 'eq',
      value: 'Product 1',
    });
  });

  it('比較演算子を変換する', () => {
    const filter: Filter<Product> = {
      price: { gte: 1000, lte: 5000 },
    };
    const result = convertFilterToDynamo('products', filter);

    expect(result.pk).toBe('products');
    expect(result.conditions).toHaveLength(2);
    expect(result.conditions).toContainEqual({
      field: 'price',
      operator: 'gte',
      value: 1000,
    });
    expect(result.conditions).toContainEqual({
      field: 'price',
      operator: 'lte',
      value: 5000,
    });
  });

  it('in演算子を変換する', () => {
    const filter: Filter<Product> = {
      status: { in: ['active', 'pending'] },
    };
    const result = convertFilterToDynamo('products', filter);

    expect(result).toEqual({
      pk: 'products',
      conditions: [
        {
          field: 'status',
          operator: 'in',
          value: ['active', 'pending'],
        },
      ],
    });
  });

  it('exists演算子を変換する', () => {
    const filter: Filter<Product> = {
      name: { exists: true },
    };
    const result = convertFilterToDynamo('products', filter);

    expect(result).toEqual({
      pk: 'products',
      conditions: [
        {
          field: 'name',
          operator: 'exists',
          value: true,
        },
      ],
    });
  });

  it('AND条件を変換する', () => {
    const filter: Filter<Product> = {
      and: [{ status: 'active' }, { price: { gte: 1000 } }],
    };
    const result = convertFilterToDynamo('products', filter);

    expect(result.pk).toBe('products');
    expect(result.conditions).toHaveLength(2);
    expect(result.conditions).toContainEqual({
      field: 'status',
      operator: 'eq',
      value: 'active',
    });
    expect(result.conditions).toContainEqual({
      field: 'price',
      operator: 'gte',
      value: 1000,
    });
    expect(result.logicalOperator).toBeUndefined(); // ANDはデフォルト
  });

  it('OR条件を変換する', () => {
    const filter: Filter<Product> = {
      or: [{ status: 'active' }, { priority: { gte: 5 } }],
    };
    const result = convertFilterToDynamo('products', filter);

    expect(result.pk).toBe('products');
    expect(result.conditions).toHaveLength(2);
    expect(result.conditions).toContainEqual({
      field: 'status',
      operator: 'eq',
      value: 'active',
    });
    expect(result.conditions).toContainEqual({
      field: 'priority',
      operator: 'gte',
      value: 5,
    });
    expect(result.logicalOperator).toBe('OR');
  });

  it('複雑な条件を変換する', () => {
    const filter: Filter<Product> = {
      status: 'active',
      price: { gte: 1000, lte: 5000 },
      stock: { gt: 0 },
    };
    const result = convertFilterToDynamo('products', filter);

    expect(result.pk).toBe('products');
    expect(result.conditions).toHaveLength(4);
    expect(result.conditions).toContainEqual({
      field: 'status',
      operator: 'eq',
      value: 'active',
    });
    expect(result.conditions).toContainEqual({
      field: 'price',
      operator: 'gte',
      value: 1000,
    });
    expect(result.conditions).toContainEqual({
      field: 'price',
      operator: 'lte',
      value: 5000,
    });
    expect(result.conditions).toContainEqual({
      field: 'stock',
      operator: 'gt',
      value: 0,
    });
  });

  it('nullとundefinedの値をスキップする', () => {
    const filter: Filter<Product> = {
      status: 'active',
      name: null as any,
      price: undefined as any,
    };
    const result = convertFilterToDynamo('products', filter);

    expect(result.pk).toBe('products');
    expect(result.conditions).toHaveLength(1);
    expect(result.conditions).toContainEqual({
      field: 'status',
      operator: 'eq',
      value: 'active',
    });
  });

  it('regex演算子をcontainsに変換する', () => {
    const filter: Filter<Product> = {
      name: { regex: 'test' },
    };
    const result = convertFilterToDynamo('products', filter);

    expect(result).toEqual({
      pk: 'products',
      conditions: [
        {
          field: 'name',
          operator: 'contains',
          value: 'test',
        },
      ],
    });
  });
});
