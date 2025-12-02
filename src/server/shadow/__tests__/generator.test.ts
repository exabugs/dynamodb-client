/**
 * シャドウジェネレーターのテスト
 */
import { describe, it, expect } from 'vitest';
import {
  truncateString,
  formatNumberWithOffset,
  normalizeJson,
  formatFieldValue,
  generateShadowRecords,
} from '../generator.js';
import type { ShadowConfig } from '../config.js';

const mockConfig: ShadowConfig = {
  createdAtField: 'createdAt',
  updatedAtField: 'updatedAt',
  stringMaxBytes: 100,
  numberPadding: 15,
};

describe('truncateString', () => {
  it('100バイト以下の文字列はそのまま返す', () => {
    const str = 'Hello World';
    expect(truncateString(str, 100)).toBe(str);
  });

  it('100バイトを超える文字列を切り詰める', () => {
    const str = 'a'.repeat(150);
    const result = truncateString(str, 100);
    const encoder = new TextEncoder();
    expect(encoder.encode(result).length).toBeLessThanOrEqual(100);
  });

  it('マルチバイト文字の境界を考慮する', () => {
    // 日本語は1文字3バイト
    const str = 'あ'.repeat(50); // 150バイト
    const result = truncateString(str, 100);
    const encoder = new TextEncoder();
    expect(encoder.encode(result).length).toBeLessThanOrEqual(100);
    // 不完全な文字が含まれていないことを確認
    expect(result).not.toContain('\uFFFD');
  });
});

describe('formatNumberWithOffset', () => {
  it('正の数を正しくフォーマットする', () => {
    expect(formatNumberWithOffset(123, 15)).toBe('1000000000000123');
    expect(formatNumberWithOffset(99999, 15)).toBe('1000000000099999');
  });

  it('負の数を正しくフォーマットする', () => {
    expect(formatNumberWithOffset(-42, 15)).toBe('0999999999999958');
    expect(formatNumberWithOffset(-99999, 15)).toBe('0999999999900001');
  });

  it('ゼロを正しくフォーマットする', () => {
    expect(formatNumberWithOffset(0, 15)).toBe('1000000000000000');
  });

  it('範囲外の数値はエラーをスローする', () => {
    const maxValue = Math.pow(10, 15);
    expect(() => formatNumberWithOffset(maxValue, 15)).toThrow('out of range');
    expect(() => formatNumberWithOffset(-maxValue - 1, 15)).toThrow('out of range');
  });
});

describe('normalizeJson', () => {
  it('idを先頭に配置する', () => {
    const obj = { title: 'A', id: '123', author: 'B' };
    const result = normalizeJson(obj) as Record<string, unknown>;
    expect(Object.keys(result)[0]).toBe('id');
  });

  it('その他のフィールドをアルファベット順に配置する', () => {
    const obj = { id: '123', zebra: 'Z', apple: 'A', banana: 'B' };
    const result = normalizeJson(obj) as Record<string, unknown>;
    const keys = Object.keys(result);
    expect(keys).toEqual(['id', 'apple', 'banana', 'zebra']);
  });

  it('createdAt, updatedAtを末尾に配置する', () => {
    const obj = {
      updatedAt: '2024-01-15T10:30:00Z',
      title: 'A',
      id: '123',
      createdAt: '2024-01-15T10:00:00Z',
    };
    const result = normalizeJson(obj) as Record<string, unknown>;
    const keys = Object.keys(result);
    expect(keys[keys.length - 2]).toBe('createdAt');
    expect(keys[keys.length - 1]).toBe('updatedAt');
  });

  it('ネストされたオブジェクトも正規化する', () => {
    const obj = {
      id: '123',
      metadata: {
        updatedAt: '2024-01-15T10:30:00Z',
        category: 'tech',
        id: 'meta-123',
      },
    };
    const result = normalizeJson(obj) as Record<string, unknown>;
    const metadata = result.metadata as Record<string, unknown>;
    const metadataKeys = Object.keys(metadata);
    expect(metadataKeys[0]).toBe('id');
    expect(metadataKeys[metadataKeys.length - 1]).toBe('updatedAt');
  });

  it('配列内のオブジェクトも正規化する', () => {
    const arr = [
      { title: 'A', id: '1' },
      { title: 'B', id: '2' },
    ];
    const result = normalizeJson(arr) as Array<Record<string, unknown>>;
    expect(Object.keys(result[0])[0]).toBe('id');
    expect(Object.keys(result[1])[0]).toBe('id');
  });
});

describe('formatFieldValue', () => {
  it('string型を正しくフォーマットする', () => {
    const result = formatFieldValue('string', 'Hello World', mockConfig);
    expect(result).toBe('Hello#World'); // スペースは#にエスケープ
  });

  it('string型を100バイトで切り詰める', () => {
    const longStr = 'a'.repeat(150);
    const result = formatFieldValue('string', longStr, mockConfig);
    const encoder = new TextEncoder();
    // エスケープ後のバイト数を確認
    expect(encoder.encode(result).length).toBeLessThanOrEqual(100);
  });

  it('number型を正しくフォーマットする', () => {
    const result = formatFieldValue('number', 123, mockConfig);
    expect(result).toBe('1000000000000123');
  });

  it('array型を200バイトで切り詰める', () => {
    const arr = ['tech', 'aws', 'dynamodb'];
    const result = formatFieldValue('array', arr, mockConfig);
    const encoder = new TextEncoder();
    expect(encoder.encode(result).length).toBeLessThanOrEqual(200);
  });

  it('object型を200バイトで切り詰める', () => {
    const obj = { category: 'tech', priority: 5 };
    const result = formatFieldValue('object', obj, mockConfig);
    const encoder = new TextEncoder();
    expect(encoder.encode(result).length).toBeLessThanOrEqual(200);
  });
});

describe('generateShadowRecords', () => {
  it('すべての型のフィールドに対してシャドウレコードを生成する', () => {
    const record = {
      id: '01HQXYZ123',
      title: 'Article',
      viewCount: 123,
      published: true,
      createdAt: '2024-01-15T10:30:00.000Z',
      tags: ['tech', 'aws'],
      metadata: { category: 'tech' },
    };

    const shadows = generateShadowRecords(record, 'articles', mockConfig);

    expect(shadows).toHaveLength(7); // 7つのフィールド
    expect(shadows.every((s) => s.PK === 'articles')).toBe(true);
    // シャドウレコードにはdataフィールドがない（IDはSKから抽出）
    expect(shadows.every((s) => s.SK.includes('#id#01HQXYZ123'))).toBe(true);
  });

  it('__プレフィックスのフィールドを除外する', () => {
    const record = {
      id: '01HQXYZ123',
      title: 'Article',
      __shadowKeys: ['key1', 'key2'],
      __configVersion: '1.0',
    };

    const shadows = generateShadowRecords(record, 'articles', mockConfig);

    expect(shadows).toHaveLength(2); // id と title のみ
  });

  it('null/undefinedのフィールドを除外する', () => {
    const record = {
      id: '01HQXYZ123',
      title: 'Article',
      description: null,
      author: undefined,
    };

    const shadows = generateShadowRecords(record, 'articles', mockConfig);

    expect(shadows).toHaveLength(2); // id と title のみ
  });

  it('シャドウキーが正しいフォーマットで生成される', () => {
    const record = {
      id: '01HQXYZ123',
      title: 'Test Article',
    };

    const shadows = generateShadowRecords(record, 'articles', mockConfig);

    const titleShadow = shadows.find((s) => s.SK.startsWith('title#'));
    expect(titleShadow).toBeDefined();
    expect(titleShadow?.SK).toBe('title#Test#Article#id#01HQXYZ123');
  });
});
