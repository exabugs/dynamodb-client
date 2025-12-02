/**
 * シャドウフィールドの型推論
 *
 * レコードのフィールド値から型を自動的に推論します。
 * JSON設定ファイルは不要で、実行時に型を判定します。
 *
 * 要件: 3.1-3.9
 */
import type { ShadowFieldType } from './types.js';

/**
 * フィールド値から型を推論する
 *
 * @param value - 推論するフィールド値
 * @returns 推論された型、またはnull（シャドウ化不可能な場合）
 *
 * @example
 * ```typescript
 * inferFieldType('Hello') // => 'string'
 * inferFieldType(123) // => 'number'
 * inferFieldType(true) // => 'boolean'
 * inferFieldType('2024-01-15T10:30:00.000Z') // => 'datetime'
 * inferFieldType(['a', 'b']) // => 'array'
 * inferFieldType({ key: 'value' }) // => 'object'
 * inferFieldType(null) // => null
 * inferFieldType(undefined) // => null
 * ```
 */
export function inferFieldType(value: unknown): ShadowFieldType | null {
  // null/undefined は除外
  if (value === null || value === undefined) {
    return null;
  }

  // 型判定
  if (typeof value === 'string') {
    // ISO 8601形式の日時文字列かチェック
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      return 'datetime';
    }
    return 'string';
  }

  if (typeof value === 'number') {
    return 'number';
  }

  if (typeof value === 'boolean') {
    return 'boolean';
  }

  // array型
  if (Array.isArray(value)) {
    return 'array';
  }

  // object型
  if (typeof value === 'object') {
    return 'object';
  }

  return null;
}

/**
 * レコードから自動的にシャドウ可能なフィールドを抽出する
 *
 * @param record - レコードオブジェクト
 * @returns フィールド名と型のマップ
 *
 * @example
 * ```typescript
 * const record = {
 *   id: '01HQXYZ...',
 *   title: 'Article',
 *   viewCount: 123,
 *   published: true,
 *   createdAt: '2024-01-15T10:30:00.000Z',
 *   tags: ['tech', 'aws'],
 *   metadata: { category: 'tech' },
 *   __shadowKeys: ['...'], // 除外される
 * };
 *
 * extractShadowableFields(record);
 * // => {
 * //   id: 'string',
 * //   title: 'string',
 * //   viewCount: 'number',
 * //   published: 'boolean',
 * //   createdAt: 'datetime',
 * //   tags: 'array',
 * //   metadata: 'object'
 * // }
 * ```
 */
export function extractShadowableFields(
  record: Record<string, unknown>
): Record<string, ShadowFieldType> {
  const fields: Record<string, ShadowFieldType> = {};

  for (const [key, value] of Object.entries(record)) {
    // __ プレフィックスは除外（内部メタデータ）
    if (key.startsWith('__')) {
      continue;
    }

    // 型推論
    const type = inferFieldType(value);
    if (type) {
      fields[key] = type;
    }
  }

  return fields;
}
