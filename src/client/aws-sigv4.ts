/**
 * AWS Signature Version 4 署名ユーティリティ
 *
 * IAM 認証で Lambda Function URL にリクエストを送信する際に使用します。
 */
import { Sha256 } from '@aws-crypto/sha256-js';
import { HttpRequest } from '@smithy/protocol-http';
import { SignatureV4 } from '@smithy/signature-v4';

import { defaultProvider } from '@aws-sdk/credential-provider-node';

/**
 * AWS SigV4 署名を生成してリクエストに追加
 *
 * @param url - リクエスト URL
 * @param body - リクエストボディ
 * @param region - AWS リージョン
 * @returns 署名済みヘッダー
 */
export async function signRequest(
  url: string,
  body: string,
  region: string
): Promise<Record<string, string>> {
  const parsedUrl = new URL(url);

  // HttpRequest を作成
  const request = new HttpRequest({
    method: 'POST',
    protocol: parsedUrl.protocol,
    hostname: parsedUrl.hostname,
    path: parsedUrl.pathname,
    headers: {
      'Content-Type': 'application/json',
      host: parsedUrl.hostname,
    },
    body,
  });

  // SignatureV4 インスタンスを作成
  const signer = new SignatureV4({
    service: 'lambda',
    region,
    credentials: defaultProvider(),
    sha256: Sha256,
  });

  // リクエストに署名
  const signedRequest = await signer.sign(request);

  // ヘッダーを抽出（ヘッダー名を正規化）
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(signedRequest.headers)) {
    if (typeof value === 'string') {
      // Authorization ヘッダーは大文字にする（fetch API の制限対策）
      const headerName = key.toLowerCase() === 'authorization' ? 'Authorization' : key;
      headers[headerName] = value;
    }
  }

  // デバッグ: 署名済みヘッダーをログ出力
  console.log('AWS SigV4 signed headers:', Object.keys(headers));

  return headers;
}
