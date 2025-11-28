import { describe, expect, it } from 'vitest';

import {
  calculateShadowDiff,
  escapeString,
  formatDatetime,
  formatNumber,
  generateMainRecordSK,
  generateShadowSK,
} from '../index.js';

describe('Shadow Generator Integration', () => {
  describe('generateShadowSK', () => {
    it('文字列フィールドのシャドーSKを生成する', () => {
      const sk = generateShadowSK('name', 'Tech News', '01HZXY123', 'string');
      expect(sk).toBe('name#Tech#News#id#01HZXY123');
    });

    it('数値フィールドのシャドーSKを生成する', () => {
      const sk = generateShadowSK('priority', 123, '01HZXY123', 'number');
      expect(sk).toBe('priority#00000000000000000123#id#01HZXY123');
    });

    it('日時フィールドのシャドーSKを生成する', () => {
      const sk = generateShadowSK('createdAt', '2025-11-12T10:00:00.000Z', '01HZXY123', 'datetime');
      expect(sk).toBe('createdAt#2025-11-12T10:00:00.000Z#id#01HZXY123');
    });

    it('特殊文字を含む文字列を正しくエスケープする', () => {
      const sk = generateShadowSK('name', 'AI#ML News', '01HZXY123', 'string');
      expect(sk).toBe('name#AI##ML#News#id#01HZXY123');
    });
  });

  describe('generateMainRecordSK', () => {
    it('メインレコードのSKを生成する', () => {
      const sk = generateMainRecordSK('01HZXY123');
      expect(sk).toBe('id#01HZXY123');
    });
  });

  describe('escapeString', () => {
    it('# を ## に置換する', () => {
      expect(escapeString('AI#ML')).toBe('AI##ML');
    });

    it('スペースを # に置換する', () => {
      expect(escapeString('Tech News')).toBe('Tech#News');
    });

    it('複数の特殊文字を正しく処理する', () => {
      expect(escapeString('AI#ML News')).toBe('AI##ML#News');
    });
  });

  describe('formatNumber', () => {
    it('数値を20桁のゼロ埋め文字列に変換する', () => {
      expect(formatNumber(123)).toBe('00000000000000000123');
      expect(formatNumber(0)).toBe('00000000000000000000');
      expect(formatNumber(999999999999999)).toBe('00000999999999999999');
    });

    it('負の数値を0として扱う', () => {
      expect(formatNumber(-123)).toBe('00000000000000000000');
    });

    it('小数点以下を切り捨てる', () => {
      expect(formatNumber(123.456)).toBe('00000000000000000123');
    });

    it('無限大の場合はエラーをスローする', () => {
      expect(() => formatNumber(Infinity)).toThrow('Invalid number value');
      expect(() => formatNumber(-Infinity)).toThrow('Invalid number value');
      expect(() => formatNumber(NaN)).toThrow('Invalid number value');
    });
  });

  describe('formatDatetime', () => {
    it('ISO 8601文字列をそのまま返す', () => {
      const input = '2025-11-12T10:00:00.000Z';
      expect(formatDatetime(input)).toBe(input);
    });

    it('Dateオブジェクトを ISO 8601 に変換する', () => {
      const date = new Date('2025-11-12T10:00:00.000Z');
      expect(formatDatetime(date)).toBe('2025-11-12T10:00:00.000Z');
    });

    it('無効な日時の場合はエラーをスローする', () => {
      expect(() => formatDatetime('invalid-date')).toThrow('Invalid datetime value');
    });
  });
});

describe('Shadow Differ Integration', () => {
  describe('calculateShadowDiff', () => {
    it('追加と削除を正しく計算する', () => {
      const oldKeys = ['name#Old#Name#id#01HZXY123', 'priority#00000000000000000010#id#01HZXY123'];
      const newKeys = ['name#New#Name#id#01HZXY123', 'priority#00000000000000000010#id#01HZXY123'];

      const diff = calculateShadowDiff(oldKeys, newKeys);

      expect(diff.toDelete).toEqual(['name#Old#Name#id#01HZXY123']);
      expect(diff.toAdd).toEqual(['name#New#Name#id#01HZXY123']);
    });

    it('変更がない場合は空の差分を返す', () => {
      const keys = ['name#Same#Name#id#01HZXY123', 'priority#00000000000000000010#id#01HZXY123'];

      const diff = calculateShadowDiff(keys, keys);

      expect(diff.toDelete).toEqual([]);
      expect(diff.toAdd).toEqual([]);
    });

    it('すべて削除の場合', () => {
      const oldKeys = ['name#Old#Name#id#01HZXY123', 'priority#00000000000000000010#id#01HZXY123'];
      const newKeys: string[] = [];

      const diff = calculateShadowDiff(oldKeys, newKeys);

      expect(diff.toDelete).toEqual(oldKeys);
      expect(diff.toAdd).toEqual([]);
    });

    it('すべて追加の場合', () => {
      const oldKeys: string[] = [];
      const newKeys = ['name#New#Name#id#01HZXY123', 'priority#00000000000000000010#id#01HZXY123'];

      const diff = calculateShadowDiff(oldKeys, newKeys);

      expect(diff.toDelete).toEqual([]);
      expect(diff.toAdd).toEqual(newKeys);
    });
  });
});
