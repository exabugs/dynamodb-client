/**
 * ULID（Universally Unique Lexicographically Sortable Identifier）ユーティリティ
 * 
 * タイムスタンプベースで辞書順ソート可能なIDを生成します。
 */
import { ulid as generateUlid } from 'ulid';

/**
 * ULID（Universally Unique Lexicographically Sortable Identifier）を生成する
 *
 * ULIDは以下の特徴を持つ:
 * - 26文字の大文字英数字（Crockford's Base32）
 * - タイムスタンプベースで辞書順ソート可能
 * - UUIDと互換性のある128ビット
 * - 単調増加（同一ミリ秒内でもランダム部分が増加）
 *
 * @returns 新しいULID文字列（例: "01HZXY123456789ABCDEFGHIJK"）
 *
 * @example
 * ```typescript
 * const id = ulid();
 * console.log(id); // "01HZXY123456789ABCDEFGHIJK"
 * ```
 */
export function ulid(): string {
  return generateUlid();
}

/**
 * 指定されたタイムスタンプでULIDを生成する
 *
 * @param seedTime - Unix タイムスタンプ（ミリ秒）
 * @returns 指定されたタイムスタンプを持つULID文字列
 *
 * @example
 * ```typescript
 * const timestamp = Date.now();
 * const id = ulidWithTime(timestamp);
 * ```
 */
export function ulidWithTime(seedTime: number): string {
  return generateUlid(seedTime);
}

/**
 * ULIDからタイムスタンプを抽出する
 *
 * @param id - ULID文字列
 * @returns Unix タイムスタンプ（ミリ秒）
 *
 * @example
 * ```typescript
 * const id = ulid();
 * const timestamp = decodeTime(id);
 * console.log(new Date(timestamp));
 * ```
 */
export function decodeTime(id: string): number {
  // ULIDの最初の10文字がタイムスタンプ部分（48ビット）
  const timeChars = id.substring(0, 10);

  // Crockford's Base32デコード
  const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let time = 0;

  for (let i = 0; i < timeChars.length; i++) {
    const char = timeChars[i];
    const value = ENCODING.indexOf(char);
    if (value === -1) {
      throw new Error(`Invalid ULID character: ${char}`);
    }
    time = time * 32 + value;
  }

  return time;
}