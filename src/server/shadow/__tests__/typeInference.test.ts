/**
 * 型推論のテスト
 */
import { describe, it, expect } from 'vitest';
import { inferFieldType, extractShadowableFields } from '../typeInference.js';

describe('inferFieldType', () => {
  it('string型を正しく推論する', () => {
    expect(inferFieldType('Hello World')).toBe('string');
    expect(inferFieldType('')).toBe('string');
  });

  it('number型を正しく推論する', () => {
    expect(inferFieldType(123)).toBe('number');
    expect(inferFieldType(0)).toBe('number');
    expect(inferFieldType(-42)).toBe('number');
    expect(inferFieldType(3.14)).toBe('number');
  });

  it('boolean型を正しく推論する', () => {
    expect(inferFieldType(true)).toBe('boolean');
    expect(inferFieldType(false)).toBe('boolean');
  });

  it('datetime型を正しく推論する', () => {
    expect(inferFieldType('2024-01-15T10:30:00.000Z')).toBe('datetime');
    expect(inferFieldType('2024-01-15T10:30:00Z')).toBe('datetime');
  });

  it('array型を正しく推論する', () => {
    expect(inferFieldType([])).toBe('array');
    expect(inferFieldType(['a', 'b', 'c'])).toBe('array');
    expect(inferFieldType([1, 2, 3])).toBe('array');
  });

  it('object型を正しく推論する', () => {
    expect(inferFieldType({})).toBe('object');
    expect(inferFieldType({ key: 'value' })).toBe('object');
  });

  it('null/undefinedはnullを返す', () => {
    expect(inferFieldType(null)).toBeNull();
    expect(inferFieldType(undefined)).toBeNull();
  });
});

describe('extractShadowableFields', () => {
  it('すべての型のフィールドを抽出する', () => {
    const record = {
      id: '01HQXYZ123',
      title: 'Article',
      viewCount: 123,
      published: true,
      createdAt: '2024-01-15T10:30:00.000Z',
      tags: ['tech', 'aws'],
      metadata: { category: 'tech' },
    };

    const fields = extractShadowableFields(record);

    expect(fields).toEqual({
      id: 'string',
      title: 'string',
      viewCount: 'number',
      published: 'boolean',
      createdAt: 'datetime',
      tags: 'array',
      metadata: 'object',
    });
  });

  it('__プレフィックスのフィールドを除外する', () => {
    const record = {
      id: '01HQXYZ123',
      title: 'Article',
      __shadowKeys: ['key1', 'key2'],
      __configVersion: '1.0',
    };

    const fields = extractShadowableFields(record);

    expect(fields).toEqual({
      id: 'string',
      title: 'string',
    });
  });

  it('null/undefinedのフィールドを除外する', () => {
    const record = {
      id: '01HQXYZ123',
      title: 'Article',
      description: null,
      author: undefined,
    };

    const fields = extractShadowableFields(record);

    expect(fields).toEqual({
      id: 'string',
      title: 'string',
    });
  });
});
