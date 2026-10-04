/**
 * image policy・署名鍵をParameter Storeから取得する共通ロジック
 *
 * モジュールスコープにキャッシュし、コールドスタートごとに再取得する
 * （詳細: docs/media-design.md「image policyの管理」）。
 *
 * 取得失敗時（未登録・不正なJSON）はfail-closedとする（例外を投げる）。
 * 「取得できない＝無制限を許可」になる実装ミスを避けるため、呼び出し側は
 * この例外をそのままリクエスト拒否として扱うこと。
 */
import { GetParameterCommand, type SSMClient } from '@aws-sdk/client-ssm';

import type { ImagePolicy } from './types.js';

let cachedImagePolicy: ImagePolicy | undefined;
let cachedSigningPrivateKey: string | undefined;

function isValidImagePolicy(value: unknown): value is ImagePolicy {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.masterMaxDimension === 'number' &&
    v.masterMaxDimension > 0 &&
    Array.isArray(v.allowedContentTypes) &&
    v.allowedContentTypes.every((t) => typeof t === 'string') &&
    typeof v.maxUploadSize === 'number' &&
    v.maxUploadSize > 0
  );
}

/**
 * image policyをParameter Storeから取得する（モジュールスコープにキャッシュ）。
 *
 * @throws パラメータが未登録、または値が不正なJSON/スキーマの場合
 */
export async function getImagePolicy(
  ssmClient: SSMClient,
  paramName: string
): Promise<ImagePolicy> {
  if (cachedImagePolicy) return cachedImagePolicy;

  const result = await ssmClient.send(new GetParameterCommand({ Name: paramName }));
  const rawValue = result.Parameter?.Value;
  if (!rawValue) {
    throw new Error(`Image policy parameter not found: ${paramName}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    throw new Error(`Image policy parameter is not valid JSON: ${paramName}`);
  }

  if (!isValidImagePolicy(parsed)) {
    throw new Error(`Image policy parameter has invalid shape: ${paramName}`);
  }

  cachedImagePolicy = parsed;
  return parsed;
}

/**
 * 署名用秘密鍵をParameter Storeから取得する（モジュールスコープにキャッシュ）。
 *
 * @throws パラメータが未登録の場合
 */
export async function getSigningPrivateKey(
  ssmClient: SSMClient,
  paramName: string
): Promise<string> {
  if (cachedSigningPrivateKey) return cachedSigningPrivateKey;

  const result = await ssmClient.send(
    new GetParameterCommand({ Name: paramName, WithDecryption: true })
  );
  const value = result.Parameter?.Value;
  if (!value) {
    throw new Error(`Signing private key parameter not found: ${paramName}`);
  }

  cachedSigningPrivateKey = value;
  return value;
}

/**
 * キャッシュをクリアする（テスト専用）。
 */
export function clearSsmParamsCache(): void {
  cachedImagePolicy = undefined;
  cachedSigningPrivateKey = undefined;
}
