/**
 * S3オブジェクトメタデータの共通処理（process-handler・process-handler-dlqで共有）
 *
 * メタデータの契約の詳細: docs/media-design.md「メタデータの契約」参照
 */

/** メディアレコードに持ち込まないS3メタデータキー（original-filenameは専用フィールドとして扱う） */
const RESERVED_METADATA_KEYS = new Set(['original-filename']);

/**
 * S3オブジェクトメタデータ（x-amz-meta-プレフィックスを除いた小文字キー）から、
 * アプリ固有の追加フィールドのみを抽出する。
 */
export function extractAppMetadata(metadata: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!RESERVED_METADATA_KEYS.has(key)) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * S3メタデータの値はUS-ASCIIのみ有効なため、呼び出し側は非ASCIIの
 * originalFilename（日本語ファイル名等）をpercent-encodingして渡す契約になっている
 * （詳細: docs/media-design.md「メタデータの契約」）。ここでデコードし、
 * MediaRecordには人間が読める実際のファイル名を保存する。
 *
 * 不正なpercent-encodingの場合は、デコードを諦めて元の文字列をそのまま返す
 * （安全側: 例外で処理全体を失敗させない）。
 */
export function decodeOriginalFilename(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * 非画像ファイルのContent-Dispositionヘッダー値を構築する。
 *
 * 日本語等の非ASCIIファイル名は、RFC 6266の`filename*=UTF-8''...`拡張パラメータ
 * （RFC 5987のpercent-encoding）で埋め込む。あわせて、拡張パラメータに対応しない
 * 古いクライアント向けに、ASCII専用の`filename=`フォールバックも含める。
 */
export function buildContentDisposition(decodedFilename: string | undefined): string {
  if (!decodedFilename) return 'attachment';

  // 改行・ダブルクォートを除去（ヘッダーインジェクション対策）
  const sanitized = decodedFilename.replace(/["\r\n]/g, '');
  // ASCII専用フォールバック: 非ASCII文字を取り除いた簡易版（空ならdownloadにする）
  const asciiFallback = sanitized.replace(/[^\x20-\x7e]/g, '').trim() || 'download';
  const encoded = encodeURIComponent(sanitized);

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
