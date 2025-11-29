import type { ShadowFieldConfig, ShadowFieldType } from './types.js';

/**
 * シャドースキーマ（簡易版）
 */
export interface ShadowSchema {
  /** リソース名 */
  resource: string;
  /** ソート可能なフィールド定義 */
  sortableFields: Record<string, ShadowFieldConfig>;
}

/**
 * シャドウレコード
 */
export interface ShadowRecord {
  /** パーティションキー（リソース名） */
  PK: string;
  /** ソートキー（シャドウキー） */
  SK: string;
  /** レコードデータ（最小限の情報） */
  data: {
    /** レコードID */
    id: string;
  };
}

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
 * 真偽値を"0"または"1"に変換する
 *
 * @param value - 真偽値（null/undefinedも許容）
 * @returns "0"（false）、"1"（true）、または空文字（null/undefined）
 */
export function formatBoolean(value: boolean | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  return value ? '1' : '0';
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
  value: string | number | Date | boolean | null | undefined
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
 */
export function generateShadowSK(
  fieldName: string,
  value: string | number | Date,
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

/**
 * レコードからシャドウレコードを生成する
 *
 * sortableFieldsに定義されたフィールドのみを処理します。
 * 値がundefined/nullの場合は空文字として扱い、シャドウレコードを生成します。
 *
 * @param record - レコードオブジェクト（idフィールドを含む）
 * @param schema - シャドウスキーマ定義
 * @returns 生成されたシャドウレコードの配列
 */
export function generateShadowRecords(
  record: Record<string, unknown>,
  schema: ShadowSchema
): ShadowRecord[] {
  const shadows: ShadowRecord[] = [];

  // sortableFieldsに定義されたフィールドのみ処理
  for (const [fieldName, fieldDef] of Object.entries(schema.sortableFields)) {
    const value = record[fieldName];

    // 値を型に応じて正規化（undefined/nullは空文字として扱う）
    const normalizedValue = formatFieldValue(fieldDef.type, value as any);

    // シャドウキーを生成
    const sk = `${fieldName}#${normalizedValue}#id#${record.id}`;

    shadows.push({
      PK: schema.resource,
      SK: sk,
      data: { id: record.id as string },
    });
  }

  return shadows;
}
