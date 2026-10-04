/**
 * メディア配信用の署名付きURL生成（CloudFront Canned Policy）
 *
 * 「誰に署名URLを発行するか」の判断はこの関数の責務外（呼び出し側アプリが担う）。
 * この関数は「有効なリクエストになら署名する」機構のみを提供する（詳細: docs/media-design.md）。
 */
import { getSignedUrl } from '@aws-sdk/cloudfront-signer';

import type { SignMediaUrlParams, SignMediaUrlResult } from './types.js';

/**
 * Expires（epoch seconds）を指定した粒度に切り上げる。
 *
 * 生の現在時刻+TTLをそのまま使うと、署名APIを呼ぶたびに毎回異なる署名URLになり
 * クライアント側のブラウザキャッシュが効かない。粒度（expiresInSeconds）単位で
 * 切り上げることで、同じ時間帯内は同一URLになりブラウザキャッシュも活用できる。
 */
function roundUpExpiry(nowSeconds: number, granularitySeconds: number): number {
  return Math.ceil(nowSeconds / granularitySeconds) * granularitySeconds;
}

/**
 * メディア配信用の署名付きURLを生成する。
 *
 * width指定時は /resize/{fileId}?width=N、省略時は /master/{fileId} に署名する
 * （呼び出し元が具体的な幅を決めてから呼ぶこと。ワイルドカード署名はしない）。
 *
 * 秘密鍵の取得はこの関数の責務外（引数で受け取るだけ）。
 */
export function signMediaUrl(params: SignMediaUrlParams): SignMediaUrlResult {
  const { fileId, width, keyPairId, privateKey, baseUrl, expiresInSeconds } = params;

  if (width !== undefined && width < 1) {
    throw new Error(`Invalid width: ${width}`);
  }

  const path = width !== undefined ? `/resize/${fileId}?width=${width}` : `/master/${fileId}`;
  const targetUrl = `${baseUrl.replace(/\/$/, '')}${path}`;

  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresAt = roundUpExpiry(nowSeconds, expiresInSeconds);

  const url = getSignedUrl({
    url: targetUrl,
    dateLessThan: new Date(expiresAt * 1000).toISOString(),
    keyPairId,
    privateKey,
  });

  return { fileId, width, url, expiresAt };
}
