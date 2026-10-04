/**
 * マジックナンバー照合
 *
 * アップロード時に申告されたcontentTypeが、実際のバイト列と一致するかを検証する
 * （contentType偽装による無加工配信XSS対策。詳細: docs/media-design.md セキュリティ表#4）。
 *
 * 既知の画像形式のみ照合する。既知形式以外（任意の非画像ファイル）は
 * 「配信時にContent-Disposition: attachmentを付与し、ブラウザに解釈させない」という
 * 別の対策で守るため、ここでは照合不要（常に一致扱い）とする。
 */

type MagicSignature = { bytes: number[]; offset?: number };

const SIGNATURES: Record<string, MagicSignature[]> = {
  'image/jpeg': [{ bytes: [0xff, 0xd8, 0xff] }],
  'image/png': [{ bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  'image/gif': [
    { bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] },
    { bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] },
  ],
  'image/webp': [
    { bytes: [0x52, 0x49, 0x46, 0x46] }, // "RIFF"
    { bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 }, // "WEBP"
  ],
};

/**
 * 申告されたcontentTypeと実バイト列が一致するか検証する。
 *
 * 既知の画像形式についてのみ厳密に照合し、未知のcontentTypeは
 * （画像として処理されないため）常に一致扱いとする。
 */
export function verifyMagicBytes(contentType: string, buffer: Buffer): boolean {
  const signatures = SIGNATURES[contentType];
  if (!signatures) {
    return true;
  }

  return signatures.every((sig) => {
    const offset = sig.offset ?? 0;
    if (buffer.length < offset + sig.bytes.length) return false;
    return sig.bytes.every((byte, i) => buffer[offset + i] === byte);
  });
}

/**
 * sharpで処理してよい「画像」として扱うかどうか。
 *
 * image/svg+xmlは画像だが埋め込みスクリプトのリスクがあるため除外し、
 * 非画像ファイルと同じ経路（無加工コピー + Content-Disposition: attachment）で扱う。
 */
export function isProcessableImage(contentType: string): boolean {
  return contentType.startsWith('image/') && contentType !== 'image/svg+xml';
}
