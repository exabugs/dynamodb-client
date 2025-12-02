import type { ShadowFieldType } from './types.js';
import type { ShadowConfig } from './config.js';
import { inferFieldType } from './typeInference.js';



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
 * JSONオブジェクトのフィールドを正規化
 *
 * フィールドの順序を以下のルールで並び替えます：
 * 1. id: 先頭
 * 2. その他: アルファベット順
 * 3. createdAt, updatedAt: 末尾
 *
 * @param value - 正規化する値
 * @returns 正規化された値
 *
 * @example
 * ```typescript
 * normalizeJson({ updatedAt: '...', title: 'A', id: '1', author: 'B' })
 * // => { id: '1', author: 'B', title: 'A', updatedAt: '...' }
 * ```
 */
export function normalizeJson(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((item) => normalizeJson(item));

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};

    // 1. id を先頭に
    if ('id' in obj) sorted.id = normalizeJson(obj.id);

    // 2. その他をアルファベット順に
    const otherKeys = Object.keys(obj)
      .filter((key) => key !== 'id' && key !== 'createdAt' && key !== 'updatedAt')
      .sort();
    for (const key of otherKeys) {
      sorted[key] = normalizeJson(obj[key]);
    }

    // 3. タイムスタンプを末尾に
    if ('createdAt' in obj) sorted.createdAt = normalizeJson(obj.createdAt);
    if ('updatedAt' in obj) sorted.updatedAt = normalizeJson(obj.updatedAt);

    return sorted;
  }

  return value;
}

/**
 * 文字列を先頭Nバイトまで切り詰める（UTF-8）
 *
 * マルチバイト文字の境界を考慮して切り詰めます。
 * 切り詰め位置がマルチバイト文字の途中の場合、前の文字境界まで戻ります。
 *
 * @param value - 切り詰める文字列
 * @param maxBytes - 最大バイト数
 * @returns 切り詰められた文字列
 *
 * @example
 * ```typescript
 * truncateString('Hello World', 5) // => 'Hello'
 * truncateString('こんにちは世界', 9) // => 'こんに' (9バイト = 3文字)
 * truncateString('Hello', 100) // => 'Hello' (そのまま)
 * ```
 */
export function truncateString(value: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(value);

  if (bytes.length <= maxBytes) {
    return value;
  }

  // マルチバイト文字の境界を考慮して切り詰め
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let truncated = decoder.decode(bytes.slice(0, maxBytes));

  // 不完全な文字を削除（U+FFFDは置換文字）
  truncated = truncated.replace(/[\uFFFD]$/, '');

  return truncated;
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
 * 数値をオフセット方式でゼロパディング
 *
 * 負数を含む数値を文字列としてソート可能にするため、オフセットを加算します。
 *
 * 範囲: -10^padding ～ +10^padding
 * オフセット: 10^padding
 *
 * 注意: padding は15以下を推奨（JavaScriptの安全な整数範囲: 2^53-1 ≈ 9×10^15）
 *
 * @param value - 変換する数値
 * @param padding - パディング桁数（推奨: 15、デフォルト設定で使用）
 * @returns ゼロパディングされた文字列
 * @throws 数値が範囲外の場合
 *
 * @example
 * ```typescript
 * formatNumberWithOffset(-99999, 15) // => "0999999999900001"
 * formatNumberWithOffset(0, 15)      // => "1000000000000000"
 * formatNumberWithOffset(99999, 15)  // => "1000000000099999"
 * ```
 */
export function formatNumberWithOffset(value: number, padding: number): string {
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid number value: ${value}`);
  }

  // 範囲チェック
  const maxValue = Math.pow(10, padding);
  if (value < -maxValue || value >= maxValue) {
    throw new Error(`Number ${value} is out of range (-10^${padding} to 10^${padding})`);
  }

  // オフセットを加算
  const offset = maxValue;
  const adjusted = Math.floor(value) + offset;

  // ゼロパディング（padding + 1桁）
  return adjusted.toString().padStart(padding + 1, '0');
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
 * フィールド値を型に応じてフォーマットする（更新版）
 *
 * @param type - フィールドの型
 * @param value - フォーマットする値
 * @param config - シャドウ設定
 * @returns フォーマットされた文字列
 *
 * @example
 * ```typescript
 * const config = { stringMaxBytes: 100, numberPadding: 20, ... };
 * formatFieldValue('string', 'Hello World', config) // => 'Hello#World'
 * formatFieldValue('number', 123, config) // => '10000000000000000123'
 * formatFieldValue('array', ['a', 'b'], config) // => '["a","b"]'
 * ```
 */
export function formatFieldValue(
  type: ShadowFieldType,
  value: unknown,
  config: ShadowConfig
): string {
  switch (type) {
    case 'string': {
      if (value === null || value === undefined) {
        return '';
      }
      const str = String(value);
      const truncated = truncateString(str, config.stringMaxBytes);
      return escapeString(truncated);
    }
    case 'number':
      return formatNumberWithOffset(value as number, config.numberPadding);
    case 'datetime':
      return formatDatetime(value as string | Date);
    case 'boolean':
      return formatBoolean(value as boolean);
    case 'array':
    case 'object': {
      // JSON文字列化して2倍のバイト制限で切り詰め
      const normalized = normalizeJson(value);
      const jsonStr = JSON.stringify(normalized);
      const maxBytes = config.stringMaxBytes * 2;
      const truncated = truncateString(jsonStr, maxBytes);
      return escapeString(truncated);
    }
    default:
      throw new Error(`Unknown shadow field type: ${type}`);
  }
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
 * レコードからシャドウレコードを自動生成する（更新版）
 *
 * レコードに存在するすべてのフィールドを自動的にシャドウ化します。
 * スキーマ定義は不要で、実行時に型を推論します。
 *
 * @param record - レコードオブジェクト（idフィールドを含む）
 * @param resourceName - リソース名
 * @param config - シャドウ設定
 * @returns 生成されたシャドウレコードの配列
 *
 * @example
 * ```typescript
 * const record = {
 *   id: '01HQXYZ...',
 *   title: 'Article',
 *   viewCount: 123,
 *   tags: ['tech', 'aws'],
 * };
 * const config = getShadowConfig();
 * const shadows = generateShadowRecords(record, 'articles', config);
 * // => [
 * //   { PK: 'articles', SK: 'id#01HQXYZ...#id#01HQXYZ...', data: { id: '01HQXYZ...' } },
 * //   { PK: 'articles', SK: 'title#Article#id#01HQXYZ...', data: { id: '01HQXYZ...' } },
 * //   { PK: 'articles', SK: 'viewCount#10000000000000000123#id#01HQXYZ...', data: { id: '01HQXYZ...' } },
 * //   { PK: 'articles', SK: 'tags#["aws","tech"]#id#01HQXYZ...', data: { id: '01HQXYZ...' } },
 * // ]
 * ```
 */
export function generateShadowRecords(
  record: Record<string, unknown>,
  resourceName: string,
  config: ShadowConfig
): ShadowRecord[] {
  const shadows: ShadowRecord[] = [];

  // レコードの各フィールドを処理
  for (const [fieldName, value] of Object.entries(record)) {
    // __ プレフィックスは除外（内部メタデータ）
    if (fieldName.startsWith('__')) {
      continue;
    }

    // null/undefined は除外
    if (value === null || value === undefined) {
      continue;
    }

    // 型推論
    const type = inferFieldType(value);
    if (!type) {
      continue;
    }

    // フィールド値をフォーマット
    const formattedValue = formatFieldValue(type, value, config);

    // シャドウキーを生成
    const sk = `${fieldName}#${formattedValue}#id#${record.id}`;

    shadows.push({
      PK: resourceName,
      SK: sk,
      data: { id: record.id as string },
    });
  }

  return shadows;
}


