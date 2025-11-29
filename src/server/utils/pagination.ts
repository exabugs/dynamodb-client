/**
 * ページネーションユーティリティ
 * nextToken のエンコード/デコード（Base64URL形式）
 *
 * 要件: 5.5, 7.1
 */
import { InvalidTokenError } from '../../index.js';

/**
 * nextToken のペイロード構造
 */
interface NextTokenPayload {
  /** パーティションキー */
  PK: string;
  /** ソートキー */
  SK: string;
}

/**
 * DynamoDB LastEvaluatedKey を Base64URL エンコードされた nextToken に変換する
 *
 * @param pk - パーティションキー
 * @param sk - ソートキー
 * @returns Base64URL エンコードされた nextToken
 */
export function encodeNextToken(pk: string, sk: string): string {
  const payload: NextTokenPayload = { PK: pk, SK: sk };
  const json = JSON.stringify(payload);

  // Base64 エンコード
  const base64 = Buffer.from(json, 'utf-8').toString('base64');

  // Base64URL 形式に変換（URL セーフ）
  const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  return base64url;
}

/**
 * Base64URL エンコードされた nextToken を DynamoDB ExclusiveStartKey にデコードする
 *
 * @param token - Base64URL エンコードされた nextToken
 * @returns デコードされた NextTokenPayload
 * @throws {InvalidTokenError} トークンのデコードに失敗した場合
 */
export function decodeNextToken(token: string): NextTokenPayload {
  try {
    // Base64URL から Base64 に変換
    let base64 = token.replace(/-/g, '+').replace(/_/g, '/');

    // パディングを追加（必要に応じて）
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }

    // Base64 デコード
    const json = Buffer.from(base64, 'base64').toString('utf-8');

    // JSON パース
    const payload = JSON.parse(json) as NextTokenPayload;

    // 必須フィールドの検証
    if (!payload.PK || !payload.SK) {
      throw new Error('Missing required fields in token payload');
    }

    return payload;
  } catch (error) {
    throw new InvalidTokenError('Failed to decode nextToken', {
      token,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
