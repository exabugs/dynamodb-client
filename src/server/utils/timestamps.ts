/**
 * タイムスタンプフィールド管理ユーティリティ
 *
 * shadow.config.json のデータベース設定から
 * タイムスタンプフィールド名を取得し、動的に設定する
 */
import { getShadowConfig } from '../../index.js';

/**
 * タイムスタンプフィールド設定
 */
export interface TimestampFields {
  createdAt: string;
  updatedAt: string;
}

/**
 * タイムスタンプフィールド設定を取得する
 *
 * shadow.config.json の database.timestamps から取得
 * 設定がない場合はデフォルト値（createdAt, updatedAt）を使用
 *
 * @returns タイムスタンプフィールド設定、または null（無効化されている場合）
 */
export function getTimestampFields(): TimestampFields | null {
  const shadowConfig = getShadowConfig();

  // 新しい設定形式: 環境変数ベース
  return {
    createdAt: shadowConfig.createdAtField,
    updatedAt: shadowConfig.updatedAtField,
  };
}

/**
 * レコードデータにタイムスタンプフィールドを追加する（作成時）
 *
 * @param data - レコードデータ
 * @returns タイムスタンプが追加されたレコードデータ
 */
export function addCreateTimestamps(data: Record<string, unknown>): Record<string, unknown> {
  const timestampFields = getTimestampFields();

  // タイムスタンプが無効化されている場合はそのまま返す
  if (!timestampFields) {
    return data;
  }

  const now = new Date().toISOString();

  return {
    ...data,
    [timestampFields.createdAt]: now,
    [timestampFields.updatedAt]: now,
  };
}

/**
 * レコードデータにタイムスタンプフィールドを追加する（更新時）
 *
 * @param data - レコードデータ
 * @returns タイムスタンプが追加されたレコードデータ
 */
export function addUpdateTimestamp(data: Record<string, unknown>): Record<string, unknown> {
  const timestampFields = getTimestampFields();

  // タイムスタンプが無効化されている場合はそのまま返す
  if (!timestampFields) {
    return data;
  }

  const now = new Date().toISOString();

  return {
    ...data,
    [timestampFields.updatedAt]: now,
  };
}
