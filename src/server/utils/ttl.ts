/**
 * TTL（Time To Live）ユーティリティ
 * DynamoDB TTL設定を管理
 */
import { createLogger } from '../../index.js';

const logger = createLogger({ service: 'records-lambda' });

/**
 * TTLを計算する
 *
 * @param resource - リソース名
 * @param createdAt - 作成日時（ISO 8601形式）
 * @returns TTL（Unix timestamp、秒単位）、TTL不要の場合はundefined
 */
export function calculateTTL(resource: string, createdAt: string): number | undefined {
  // 新しい実装: 環境変数ベースのTTL設定
  // 環境変数から取得（例: ARTICLES_TTL_DAYS=30）
  const envKey = `${resource.toUpperCase()}_TTL_DAYS`;
  const ttlDaysStr = process.env[envKey];

  if (!ttlDaysStr) {
    // TTL設定がないリソースはundefinedを返す
    return undefined;
  }

  const ttlDays = parseInt(ttlDaysStr, 10);
  if (isNaN(ttlDays) || ttlDays <= 0) {
    logger.warn('Invalid TTL_DAYS value', { resource, envKey, value: ttlDaysStr });
    return undefined;
  }

  // 作成日時からTTLを計算
  const createdAtMs = new Date(createdAt).getTime();
  const ttlMs = createdAtMs + ttlDays * 24 * 60 * 60 * 1000;
  const ttl = Math.floor(ttlMs / 1000);

  logger.debug('TTL calculated', {
    resource,
    ttlDays,
    createdAt,
    ttl,
    ttlDate: new Date(ttl * 1000).toISOString(),
  });

  return ttl;
}

/**
 * レコードデータにTTLを追加する
 *
 * @param resource - リソース名
 * @param recordData - レコードデータ
 * @returns TTLが追加されたレコードデータ
 */
export function addTTL(
  resource: string,
  recordData: Record<string, unknown>
): Record<string, unknown> {
  const createdAt = recordData.createdAt as string;
  if (!createdAt) {
    logger.warn('createdAt not found, skipping TTL calculation', { resource });
    return recordData;
  }

  const ttl = calculateTTL(resource, createdAt);
  if (ttl === undefined) {
    // TTL不要のリソース
    return recordData;
  }

  return {
    ...recordData,
    ttl,
  };
}
