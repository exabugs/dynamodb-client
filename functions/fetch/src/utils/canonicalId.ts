/**
 * Canonical ID生成ユーティリティ
 *
 * 記事の重複を防ぐため、URLまたはタイトルから一意のIDを生成する
 * 同じ記事（同じURL）は常に同じIDを持つ
 */
import { createHash } from 'crypto';

/**
 * URLまたはタイトルからcanonical IDを生成する
 *
 * - URLベースのSHA-256ハッシュ（26文字、ULID互換の長さ）
 * - URLがない場合はタイトルを使用
 * - 大文字に変換して一貫性を保つ
 *
 * @param url - 記事のURL（優先）
 * @param title - 記事のタイトル（フォールバック）
 * @returns canonical ID（26文字の16進数文字列、大文字）
 */
export function generateCanonicalId(url: string | null, title: string | null): string {
  // URLまたはタイトルを使用（URLを優先）
  const source = url || title || '';

  if (!source) {
    throw new Error('URL or title is required to generate canonical ID');
  }

  // 正規化: トリム、小文字化
  const normalized = source.trim().toLowerCase();

  // SHA-256ハッシュ生成
  const hash = createHash('sha256').update(normalized, 'utf8').digest('hex');

  // 最初の26文字を取得（ULID互換の長さ）
  // 大文字に変換して一貫性を保つ
  return hash.substring(0, 26).toUpperCase();
}
