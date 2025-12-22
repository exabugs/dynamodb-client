/**
 * バリデーションユーティリティ
 * 
 * 共通のバリデーション処理を提供します。
 */
import { InvalidFilterError } from '../errors/index.js';

/**
 * 必須フィールドの存在をチェックする
 *
 * @param obj - チェック対象のオブジェクト
 * @param fields - 必須フィールド名の配列
 * @throws {Error} 必須フィールドが不足している場合
 */
export function validateRequiredFields(obj: Record<string, unknown>, fields: string[]): void {
  const missingFields = fields.filter(field => obj[field] === undefined || obj[field] === null);
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }
}

/**
 * 文字列が空でないことをチェックする
 *
 * @param value - チェック対象の値
 * @param fieldName - フィールド名（エラーメッセージ用）
 * @throws {Error} 値が空文字列または空白のみの場合
 */
export function validateNonEmptyString(value: unknown, fieldName: string): void {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${fieldName} must be a non-empty string`);
  }
}

/**
 * 数値が有効な範囲内にあることをチェックする
 *
 * @param value - チェック対象の値
 * @param fieldName - フィールド名（エラーメッセージ用）
 * @param min - 最小値（オプション）
 * @param max - 最大値（オプション）
 * @throws {Error} 値が数値でないか範囲外の場合
 */
export function validateNumberRange(
  value: unknown,
  fieldName: string,
  min?: number,
  max?: number
): void {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new Error(`${fieldName} must be a valid number`);
  }

  if (min !== undefined && value < min) {
    throw new Error(`${fieldName} must be at least ${min}`);
  }

  if (max !== undefined && value > max) {
    throw new Error(`${fieldName} must be at most ${max}`);
  }
}

/**
 * 配列が空でないことをチェックする
 *
 * @param value - チェック対象の値
 * @param fieldName - フィールド名（エラーメッセージ用）
 * @throws {Error} 値が配列でないか空配列の場合
 */
export function validateNonEmptyArray(value: unknown, fieldName: string): void {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${fieldName} must be a non-empty array`);
  }
}

/**
 * ソートフィールドが有効かどうかをチェックする
 *
 * @param sortField - ソートフィールド名
 * @param validFields - 有効なフィールド名の配列
 * @throws {InvalidFilterError} ソートフィールドが無効な場合
 */
export function validateSortField(sortField: string, validFields: string[]): void {
  if (!validFields.includes(sortField)) {
    throw new InvalidFilterError(
      `Invalid sort field: ${sortField}. Valid fields are: ${validFields.join(', ')}`,
      { sortField, validFields }
    );
  }
}

/**
 * ULIDの形式が正しいかどうかをチェックする
 *
 * @param value - チェック対象の値
 * @param fieldName - フィールド名（エラーメッセージ用）
 * @throws {Error} ULIDの形式が正しくない場合
 */
export function validateULID(value: unknown, fieldName: string): void {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }

  // ULID形式: 26文字のCrockford's Base32
  const ulidPattern = /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/;
  
  if (!ulidPattern.test(value)) {
    throw new Error(`${fieldName} must be a valid ULID format (26 characters, Crockford's Base32)`);
  }
}

/**
 * ISO 8601日時形式が正しいかどうかをチェックする
 *
 * @param value - チェック対象の値
 * @param fieldName - フィールド名（エラーメッセージ用）
 * @throws {Error} 日時形式が正しくない場合
 */
export function validateISO8601DateTime(value: unknown, fieldName: string): void {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }

  const date = new Date(value);
  
  if (isNaN(date.getTime())) {
    throw new Error(`${fieldName} must be a valid ISO 8601 datetime string`);
  }

  // ISO 8601形式かどうかをチェック（厳密）
  const iso8601Pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
  
  if (!iso8601Pattern.test(value)) {
    throw new Error(`${fieldName} must be in ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)`);
  }
}