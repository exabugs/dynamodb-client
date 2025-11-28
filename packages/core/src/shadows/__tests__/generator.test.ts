import { describe, expect, it } from 'vitest';

import {
  escapeString,
  formatDatetime,
  formatFieldValue,
  formatNumber,
  generateMainRecordSK,
  generateShadowSK,
} from '../generator.js';

describe('Shadow Generator', () => {
  describe('escapeString', () => {
    it('# を ## に置換する', () => {
      expect(escapeString('AI#ML')).toBe('AI##ML');
    });

    it('スペースを # に置換する', () => {
      expect(escapeString('Tech News')).toBe('Tech#News');
    });

    it('複数の # を正しく処理する', () => {
      expect(escapeString('A#B#C')).toBe('A##B##C');
    });

    it('複数のスペースを正しく処理する', () => {
      expect(escapeString('A B C')).toBe('A#B#C');
    });

    it('# とスペースが混在する場合を正しく処理する', () => {
      expect(escapeString('AI#ML News')).toBe('AI##ML#News');
      expect(escapeString('Tech #News Today')).toBe('Tech###News#Today');
    });

    it('空文字列を処理する', () => {
      expect(escapeString('')).toBe('');
    });

    it('特殊文字がない場合はそのまま返す', () => {
      expect(escapeString('TechNews')).toBe('TechNews');
    });
  });

  describe('formatNumber', () => {
    it('小さい数値を20桁のゼロ埋め文字列に変換する', () => {
      expect(formatNumber(0)).toBe('00000000000000000000');
      expect(formatNumber(1)).toBe('00000000000000000001');
      expect(formatNumber(123)).toBe('00000000000000000123');
    });

    it('大きい数値を20桁のゼロ埋め文字列に変換する', () => {
      expect(formatNumber(999999999999999)).toBe('00000999999999999999');
      expect(formatNumber(123456789012345)).toBe('00000123456789012345');
    });

    it('負の数値を0として扱う', () => {
      expect(formatNumber(-1)).toBe('00000000000000000000');
      expect(formatNumber(-123)).toBe('00000000000000000000');
      expect(formatNumber(-999)).toBe('00000000000000000000');
    });

    it('小数点以下を切り捨てる', () => {
      expect(formatNumber(123.456)).toBe('00000000000000000123');
      expect(formatNumber(999.999)).toBe('00000000000000000999');
      expect(formatNumber(0.5)).toBe('00000000000000000000');
    });

    it('無限大の場合はエラーをスローする', () => {
      expect(() => formatNumber(Infinity)).toThrow('Invalid number value: Infinity');
      expect(() => formatNumber(-Infinity)).toThrow('Invalid number value: -Infinity');
    });

    it('NaNの場合はエラーをスローする', () => {
      expect(() => formatNumber(NaN)).toThrow('Invalid number value: NaN');
    });
  });

  describe('formatDatetime', () => {
    it('ISO 8601文字列を正しくフォーマットする', () => {
      const input = '2025-11-12T10:00:00.000Z';
      expect(formatDatetime(input)).toBe('2025-11-12T10:00:00.000Z');
    });

    it('異なる形式の日時文字列をISO 8601に変換する', () => {
      const input = '2025-11-12';
      const result = formatDatetime(input);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('Dateオブジェクトを ISO 8601 に変換する', () => {
      const date = new Date('2025-11-12T10:00:00.000Z');
      expect(formatDatetime(date)).toBe('2025-11-12T10:00:00.000Z');
    });

    it('タイムゾーン付き日時をUTCに変換する', () => {
      const date = new Date('2025-11-12T19:00:00+09:00');
      expect(formatDatetime(date)).toBe('2025-11-12T10:00:00.000Z');
    });

    it('無効な日時文字列の場合はエラーをスローする', () => {
      expect(() => formatDatetime('invalid-date')).toThrow('Invalid datetime value: invalid-date');
      expect(() => formatDatetime('not a date')).toThrow('Invalid datetime value: not a date');
    });

    it('無効なDateオブジェクトの場合はエラーをスローする', () => {
      const invalidDate = new Date('invalid');
      expect(() => formatDatetime(invalidDate)).toThrow('Invalid datetime value');
    });
  });

  describe('formatFieldValue', () => {
    it('string型の値を正しくフォーマットする', () => {
      expect(formatFieldValue('string', 'Tech News')).toBe('Tech#News');
      expect(formatFieldValue('string', 'AI#ML')).toBe('AI##ML');
    });

    it('number型の値を正しくフォーマットする', () => {
      expect(formatFieldValue('number', 123)).toBe('00000000000000000123');
      expect(formatFieldValue('number', 0)).toBe('00000000000000000000');
    });

    it('datetime型の値を正しくフォーマットする', () => {
      expect(formatFieldValue('datetime', '2025-11-12T10:00:00.000Z')).toBe(
        '2025-11-12T10:00:00.000Z'
      );
      const date = new Date('2025-11-12T10:00:00.000Z');
      expect(formatFieldValue('datetime', date)).toBe('2025-11-12T10:00:00.000Z');
    });

    it('未知の型の場合はエラーをスローする', () => {
      expect(() => formatFieldValue('unknown' as any, 'value')).toThrow(
        'Unknown shadow field type: unknown'
      );
    });
  });

  describe('generateShadowSK', () => {
    describe('string型フィールド', () => {
      it('基本的な文字列のシャドーSKを生成する', () => {
        const sk = generateShadowSK('name', 'Tech News', '01HZXY123', 'string');
        expect(sk).toBe('name#Tech#News#id#01HZXY123');
      });

      it('特殊文字を含む文字列のシャドーSKを生成する', () => {
        const sk = generateShadowSK('name', 'AI#ML News', '01HZXY123', 'string');
        expect(sk).toBe('name#AI##ML#News#id#01HZXY123');
      });

      it('空文字列のシャドーSKを生成する', () => {
        const sk = generateShadowSK('name', '', '01HZXY123', 'string');
        expect(sk).toBe('name##id#01HZXY123');
      });

      it('型を省略した場合はstringとして扱う', () => {
        const sk = generateShadowSK('name', 'Tech News', '01HZXY123');
        expect(sk).toBe('name#Tech#News#id#01HZXY123');
      });
    });

    describe('number型フィールド', () => {
      it('小さい数値のシャドーSKを生成する', () => {
        const sk = generateShadowSK('priority', 10, '01HZXY123', 'number');
        expect(sk).toBe('priority#00000000000000000010#id#01HZXY123');
      });

      it('大きい数値のシャドーSKを生成する', () => {
        const sk = generateShadowSK('priority', 123456789, '01HZXY123', 'number');
        expect(sk).toBe('priority#00000000000123456789#id#01HZXY123');
      });

      it('0のシャドーSKを生成する', () => {
        const sk = generateShadowSK('priority', 0, '01HZXY123', 'number');
        expect(sk).toBe('priority#00000000000000000000#id#01HZXY123');
      });

      it('小数を含む数値のシャドーSKを生成する（切り捨て）', () => {
        const sk = generateShadowSK('priority', 123.456, '01HZXY123', 'number');
        expect(sk).toBe('priority#00000000000000000123#id#01HZXY123');
      });
    });

    describe('datetime型フィールド', () => {
      it('ISO 8601文字列のシャドーSKを生成する', () => {
        const sk = generateShadowSK(
          'createdAt',
          '2025-11-12T10:00:00.000Z',
          '01HZXY123',
          'datetime'
        );
        expect(sk).toBe('createdAt#2025-11-12T10:00:00.000Z#id#01HZXY123');
      });

      it('DateオブジェクトのシャドーSKを生成する', () => {
        const date = new Date('2025-11-12T10:00:00.000Z');
        const sk = generateShadowSK('updatedAt', date, '01HZXY123', 'datetime');
        expect(sk).toBe('updatedAt#2025-11-12T10:00:00.000Z#id#01HZXY123');
      });

      it('異なるタイムゾーンの日時をUTCに変換する', () => {
        const date = new Date('2025-11-12T19:00:00+09:00');
        const sk = generateShadowSK('createdAt', date, '01HZXY123', 'datetime');
        expect(sk).toBe('createdAt#2025-11-12T10:00:00.000Z#id#01HZXY123');
      });
    });

    describe('複数のレコードID', () => {
      it('異なるレコードIDで異なるSKを生成する', () => {
        const sk1 = generateShadowSK('name', 'Tech News', '01HZXY123', 'string');
        const sk2 = generateShadowSK('name', 'Tech News', '01HZXY456', 'string');

        expect(sk1).toBe('name#Tech#News#id#01HZXY123');
        expect(sk2).toBe('name#Tech#News#id#01HZXY456');
        expect(sk1).not.toBe(sk2);
      });
    });
  });

  describe('generateMainRecordSK', () => {
    it('メインレコードのSKを生成する', () => {
      const sk = generateMainRecordSK('01HZXY123');
      expect(sk).toBe('id#01HZXY123');
    });

    it('異なるIDで異なるSKを生成する', () => {
      const sk1 = generateMainRecordSK('01HZXY123');
      const sk2 = generateMainRecordSK('01HZXY456');

      expect(sk1).toBe('id#01HZXY123');
      expect(sk2).toBe('id#01HZXY456');
      expect(sk1).not.toBe(sk2);
    });

    it('空文字列のIDでもSKを生成する', () => {
      const sk = generateMainRecordSK('');
      expect(sk).toBe('id#');
    });
  });
});
