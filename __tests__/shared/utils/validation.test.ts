/**
 * shared/utils/validation.ts のユニットテスト
 * バリデーションユーティリティのテスト
 */
import { describe, expect, it } from 'vitest';

import { InvalidFilterError } from '../../../src/shared/errors/index.js';
import {
  validateISO8601DateTime,
  validateNonEmptyArray,
  validateNonEmptyString,
  validateNumberRange,
  validateRequiredFields,
  validateSortField,
  validateULID,
} from '../../../src/shared/utils/validation.js';

describe('shared/utils/validation', () => {
  describe('validateRequiredFields', () => {
    it('すべての必須フィールドが存在する場合は成功する', () => {
      const obj = { name: 'test', age: 30, email: 'test@example.com' };
      expect(() => validateRequiredFields(obj, ['name', 'age'])).not.toThrow();
    });

    it('必須フィールドが不足している場合はエラーをスローする', () => {
      const obj = { name: 'test' };
      expect(() => validateRequiredFields(obj, ['name', 'age'])).toThrow(
        'Missing required fields: age'
      );
    });

    it('複数の必須フィールドが不足している場合はエラーをスローする', () => {
      const obj = { name: 'test' };
      expect(() => validateRequiredFields(obj, ['name', 'age', 'email'])).toThrow(
        'Missing required fields: age, email'
      );
    });

    it('フィールドがnullの場合はエラーをスローする', () => {
      const obj = { name: 'test', age: null };
      expect(() => validateRequiredFields(obj, ['name', 'age'])).toThrow(
        'Missing required fields: age'
      );
    });
  });

  describe('validateNonEmptyString', () => {
    it('空でない文字列の場合は成功する', () => {
      expect(() => validateNonEmptyString('test', 'name')).not.toThrow();
    });

    it('空文字列の場合はエラーをスローする', () => {
      expect(() => validateNonEmptyString('', 'name')).toThrow('name must be a non-empty string');
    });

    it('空白のみの文字列の場合はエラーをスローする', () => {
      expect(() => validateNonEmptyString('   ', 'name')).toThrow(
        'name must be a non-empty string'
      );
    });

    it('文字列でない場合はエラーをスローする', () => {
      expect(() => validateNonEmptyString(123, 'name')).toThrow('name must be a non-empty string');
    });
  });

  describe('validateNumberRange', () => {
    it('有効な数値の場合は成功する', () => {
      expect(() => validateNumberRange(50, 'age')).not.toThrow();
    });

    it('最小値以上の場合は成功する', () => {
      expect(() => validateNumberRange(50, 'age', 0, 100)).not.toThrow();
    });

    it('最大値以下の場合は成功する', () => {
      expect(() => validateNumberRange(50, 'age', 0, 100)).not.toThrow();
    });

    it('数値でない場合はエラーをスローする', () => {
      expect(() => validateNumberRange('50', 'age')).toThrow('age must be a valid number');
    });

    it('NaNの場合はエラーをスローする', () => {
      expect(() => validateNumberRange(NaN, 'age')).toThrow('age must be a valid number');
    });

    it('最小値未満の場合はエラーをスローする', () => {
      expect(() => validateNumberRange(-1, 'age', 0, 100)).toThrow('age must be at least 0');
    });

    it('最大値超過の場合はエラーをスローする', () => {
      expect(() => validateNumberRange(101, 'age', 0, 100)).toThrow('age must be at most 100');
    });
  });

  describe('validateNonEmptyArray', () => {
    it('空でない配列の場合は成功する', () => {
      expect(() => validateNonEmptyArray([1, 2, 3], 'items')).not.toThrow();
    });

    it('空配列の場合はエラーをスローする', () => {
      expect(() => validateNonEmptyArray([], 'items')).toThrow('items must be a non-empty array');
    });

    it('配列でない場合はエラーをスローする', () => {
      expect(() => validateNonEmptyArray('not an array', 'items')).toThrow(
        'items must be a non-empty array'
      );
    });
  });

  describe('validateSortField', () => {
    it('有効なソートフィールドの場合は成功する', () => {
      expect(() => validateSortField('name', ['name', 'age', 'email'])).not.toThrow();
    });

    it('無効なソートフィールドの場合はInvalidFilterErrorをスローする', () => {
      expect(() => validateSortField('invalid', ['name', 'age', 'email'])).toThrow(
        InvalidFilterError
      );
    });

    it('エラーメッセージに有効なフィールド一覧が含まれる', () => {
      expect(() => validateSortField('invalid', ['name', 'age', 'email'])).toThrow(
        'Invalid sort field: invalid. Valid fields are: name, age, email'
      );
    });
  });

  describe('validateULID', () => {
    it('有効なULID形式の場合は成功する', () => {
      expect(() => validateULID('01ARZ3NDEKTSV4RRFFQ69G5FAV', 'id')).not.toThrow();
    });

    it('26文字のCrockford Base32の場合は成功する', () => {
      expect(() => validateULID('01234567890ABCDEFGHJKMNPQR', 'id')).not.toThrow();
    });

    it('文字列でない場合はエラーをスローする', () => {
      expect(() => validateULID(123, 'id')).toThrow('id must be a string');
    });

    it('26文字未満の場合はエラーをスローする', () => {
      expect(() => validateULID('01ARZ3NDEKTSV4RRFFQ69G5FA', 'id')).toThrow(
        'id must be a valid ULID format'
      );
    });

    it('26文字超過の場合はエラーをスローする', () => {
      expect(() => validateULID('01ARZ3NDEKTSV4RRFFQ69G5FAVX', 'id')).toThrow(
        'id must be a valid ULID format'
      );
    });

    it('無効な文字を含む場合はエラーをスローする', () => {
      expect(() => validateULID('01ARZ3NDEKTSV4RRFFQ69G5FAI', 'id')).toThrow(
        'id must be a valid ULID format'
      );
    });
  });

  describe('validateISO8601DateTime', () => {
    it('有効なISO 8601形式の場合は成功する', () => {
      expect(() => validateISO8601DateTime('2023-01-01T00:00:00.000Z', 'createdAt')).not.toThrow();
    });

    it('ミリ秒なしのISO 8601形式の場合は成功する', () => {
      expect(() => validateISO8601DateTime('2023-01-01T00:00:00Z', 'createdAt')).not.toThrow();
    });

    it('Zなしのローカル時刻形式の場合は成功する', () => {
      expect(() => validateISO8601DateTime('2023-01-01T00:00:00', 'createdAt')).not.toThrow();
    });

    it('文字列でない場合はエラーをスローする', () => {
      expect(() => validateISO8601DateTime(123, 'createdAt')).toThrow('createdAt must be a string');
    });

    it('無効な日時形式の場合はエラーをスローする', () => {
      expect(() => validateISO8601DateTime('invalid-date', 'createdAt')).toThrow(
        'createdAt must be a valid ISO 8601 datetime string'
      );
    });

    it('ISO 8601形式でない場合はエラーをスローする', () => {
      expect(() => validateISO8601DateTime('01/01/2023', 'createdAt')).toThrow(
        'createdAt must be in ISO 8601 format'
      );
    });
  });
});
