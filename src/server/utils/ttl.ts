/**
 * TTL（Time To Live）ユーティリティ
 * DynamoDB TTL設定を管理
 */
import { createLogger, getShadowConfig } from '../../index.js';

const logger = createLogger({ service: 'records-lambda' });

/**
 * TTLを計算する
 *
 * @param resource - リソース名
 * @param createdAt - 作成日時（ISO 8601形式）
 * @returns TTL（Unix timestamp、秒単位）、TTL不要の場合はundefined
 */
export function calculateTTL(resource: string, createdAt: string): number | undefined {
  // shadow.config.jsonからTTL設定を取得
  const shadowConfig = getShadowConfig();
  const resourceConfig = shadowConfig.resources[resource];

  if (!resourceConfig?.ttl) {
    // TTL設定がないリソースはundefinedを返す
    return undefined;
  }

  const defaultDays = resourceConfig.ttl.days;

  // 環境変数から上書き可能（後方互換性のため）
  const envKey = `${resource.toUpperCase()}_TTL_DAYS`;
  const ttlDays = parseInt(process.env[envKey] || String(defaultDays), 10);

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
