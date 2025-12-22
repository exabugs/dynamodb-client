/**
 * DynamoDB操作ユーティリティ
 */
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import { ConfigError, createDynamoDBClient, createLogger } from '../../shared/index.js';

// ロガーインスタンス
const logger = createLogger({ service: 'records-lambda' });

/**
 * DynamoDBクライアントのシングルトンインスタンス
 */
let dbClient: DynamoDBDocumentClient | null = null;

/**
 * DynamoDBクライアントを取得する（シングルトン）
 *
 * @returns DynamoDBDocumentClient
 */
export function getDBClient(): DynamoDBDocumentClient {
  if (!dbClient) {
    dbClient = createDynamoDBClient({
      region: process.env.AWS_REGION || process.env.REGION,
    });
  }
  return dbClient;
}

/**
 * 環境変数からテーブル名を取得する
 *
 * @returns DynamoDBテーブル名
 * @throws {ConfigError} TABLE_NAME環境変数が未設定の場合
 */
export function getTableName(): string {
  const tableName = process.env.TABLE_NAME;

  if (!tableName) {
    throw new ConfigError('TABLE_NAME environment variable is not set');
  }

  return tableName;
}

/**
 * レコードから__shadowKeysを除外する
 *
 * @param record - DynamoDBレコード
 * @returns __shadowKeysを除外したレコード
 */
export function removeShadowKeys(record: Record<string, unknown>): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { __shadowKeys, ...rest } = record;
  return rest;
}

/**
 * data属性からレコードを抽出し、__shadowKeysを除外する
 *
 * @param item - DynamoDBアイテム（PK, SK, data構造）
 * @returns クリーンなレコード
 */
export function extractCleanRecord(item: Record<string, unknown>): Record<string, unknown> {
  const data = item.data as Record<string, unknown>;
  return removeShadowKeys(data);
}

/**
 * DynamoDB操作を実行し、権限不足エラーを適切にハンドリングする
 *
 * @param operation - 実行するDynamoDB操作
 * @param operationName - 操作名（ログ用）
 * @returns 操作結果
 * @throws {Error} 権限不足エラーまたはその他のエラー
 */
export async function executeDynamoDBOperation<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  try {
    return await operation();
  } catch (error: unknown) {
    // 権限不足エラーの場合、詳細なログを出力
    if (error instanceof Error && error.name === 'AccessDeniedException') {
      logger.error('DynamoDB access denied', {
        errorName: error.name,
        errorMessage: error.message,
        operation: operationName,
        tableName: process.env.TABLE_NAME,
        region: process.env.AWS_REGION || process.env.REGION,
      });
      throw new Error(`Insufficient permissions to access DynamoDB: ${operationName}`);
    }

    // その他のエラーはそのまま再スロー
    throw error;
  }
}
