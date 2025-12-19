import type { ShadowFieldType } from './schema.js';

/**
 * 文字列値をエスケープする
 * ルール: # → ##, スペース → #
 *
 * @param value - エスケープする文字列
 * @returns エスケープされた文字列
 */
export function escapeString(value: string): string {
  return value
    .replace(/#/g, '##') // # を ## に置換
    .replace(/ /g, '#'); // スペースを # に置換
}

/**
 * 数値を20桁のゼロ埋め文字列に変換する
 *
 * @param value - 変換する数値（null/undefinedも許容）
 * @returns 20桁のゼロ埋め文字列
 */
export function formatNumber(value: number | null | undefined): string {
  // null/undefined は空文字を返す
  if (value === null || value === undefined) {
    return '';
  }

  if (!Number.isFinite(value)) {
    throw new Error(`Invalid number value: ${value}`);
  }

  // 負の数値は0として扱う（または別のエラーハンドリング）
  const normalized = Math.max(0, Math.floor(value));

  return normalized.toString().padStart(20, '0');
}

/**
 * 日時をUTC ISO 8601形式にフォーマットする
 *
 * @param value - 日時文字列またはDateオブジェクト（null/undefinedも許容）
 * @returns UTC ISO 8601形式の文字列
 */
export function formatDatetime(value: string | Date | null | undefined): string {
  // null/undefined は空文字を返す
  if (value === null || value === undefined) {
    return '';
  }

  const date = typeof value === 'string' ? new Date(value) : value;

  if (isNaN(date.getTime())) {
    throw new Error(`Invalid datetime value: ${value}`);
  }

  return date.toISOString();
}

/**
 * boolean値をフォーマットする
 *
 * @param value - boolean値（null/undefinedも許容）
 * @returns 'true' または 'false' または空文字
 */
export function formatBoolean(value: boolean | null | undefined): string {
  // null/undefined は空文字を返す
  if (value === null || value === undefined) {
    return '';
  }

  return value ? 'true' : 'false';
}

/**
 * 配列をJSON文字列にフォーマットする
 *
 * @param value - 配列（null/undefinedも許容）
 * @returns JSON文字列または空文字
 */
export function formatArray(value: any[] | null | undefined): string {
  // null/undefined は空文字を返す
  if (value === null || value === undefined) {
    return '';
  }

  if (!Array.isArray(value)) {
    throw new Error(`Invalid array value: ${value}`);
  }

  return JSON.stringify(value);
}

/**
 * オブジェクトをJSON文字列にフォーマットする
 *
 * @param value - オブジェクト（null/undefinedも許容）
 * @returns JSON文字列または空文字
 */
export function formatObject(value: object | null | undefined): string {
  // null/undefined は空文字を返す
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid object value: ${value}`);
  }

  return JSON.stringify(value);
}

/**
 * フィールド値を型に応じてフォーマットする
 *
 * @param type - フィールドの型
 * @param value - フォーマットする値（null/undefinedも許容）
 * @returns フォーマットされた文字列
 */
export function formatFieldValue(
  type: ShadowFieldType,
  value: any
): string {
  switch (type) {
    case 'string':
      // 文字列型の場合、null/undefinedは空文字として扱う
      if (value === null || value === undefined) {
        return '';
      }
      return escapeString(String(value));
    case 'number':
      return formatNumber(value as number | null | undefined);
    case 'datetime':
      return formatDatetime(value as string | Date | null | undefined);
    case 'boolean':
      return formatBoolean(value as boolean | null | undefined);
    case 'array':
      return formatArray(value as any[] | null | undefined);
    case 'object':
      return formatObject(value as object | null | undefined);
    default:
      throw new Error(`Unknown shadow field type: ${type}`);
  }
}

/**
 * シャドーSKを生成する
 * フォーマット: {fieldName}#{formattedValue}#id#{recordId}
 *
 * @param fieldName - フィールド名
 * @param value - フィールド値
 * @param recordId - レコードID（ULID）
 * @param type - フィールドの型（デフォルト: 'string'）
 * @returns 生成されたシャドーSK
 *
 * @example
 * generateShadowSK('name', 'Tech News', '01HZXY123', 'string')
 * // => 'name#Tech#News#id#01HZXY123'
 *
 * @example
 * generateShadowSK('priority', 123, '01HZXY123', 'number')
 * // => 'priority#00000000000000000123#id#01HZXY123'
 *
 * @example
 * generateShadowSK('createdAt', '2025-11-12T10:00:00.000Z', '01HZXY123', 'datetime')
 * // => 'createdAt#2025-11-12T10:00:00.000Z#id#01HZXY123'
 *
 * @example
 * generateShadowSK('isPublished', true, '01HZXY123', 'boolean')
 * // => 'isPublished#true#id#01HZXY123'
 *
 * @example
 * generateShadowSK('tags', ['tech', 'aws'], '01HZXY123', 'array')
 * // => 'tags#["tech","aws"]#id#01HZXY123'
 *
 * @example
 * generateShadowSK('metadata', { category: 'tech' }, '01HZXY123', 'object')
 * // => 'metadata#{"category":"tech"}#id#01HZXY123'
 */
export function generateShadowSK(
  fieldName: string,
  value: any,
  recordId: string,
  type: ShadowFieldType = 'string'
): string {
  const formattedValue = formatFieldValue(type, value);
  return `${fieldName}#${formattedValue}#id#${recordId}`;
}

/**
 * レコードIDからメインレコードのSKを生成する
 * フォーマット: id#{recordId}
 *
 * @param recordId - レコードID（ULID）
 * @returns メインレコードのSK
 */
export function generateMainRecordSK(recordId: string): string {
  return `id#${recordId}`;
}
