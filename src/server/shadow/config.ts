/**
 * サーバーサイドシャドウ設定管理（簡素化版）
 *
 * シャドー設定を環境変数から読み込み、グローバル変数にキャッシュします。
 * JSON設定ファイルは廃止され、環境変数のみで管理されます。
 *
 * キャッシュの動作:
 * - 初回呼び出し時: 環境変数から読み込んでキャッシュ
 * - 2回目以降: キャッシュから即座に取得
 * - キャッシュ有効期間: Lambda実行環境が存在する間（通常15分〜数時間）
 *
 * 設定変更の反映:
 * - Terraformで環境変数を変更
 * - Lambda関数が自動的に再デプロイされ、新しい設定が反映される
 *
 * 要件: 2.9-2.11
 */

/**
 * Shadow configuration (v0.3.x environment variable-based)
 */
export interface ShadowConfig {
  /** Timestamp field names */
  createdAtField: string;
  updatedAtField: string;
  /** Maximum bytes for primitive types (array/object use 2x) */
  stringMaxBytes: number;
  /** Number padding digits */
  numberPadding: number;
}

/**
 * Global cache (reused across Lambda invocations)
 */
let cachedShadowConfig: ShadowConfig | null = null;

/**
 * Get shadow configuration from environment variables
 *
 * Loads configuration from environment variables and caches it globally.
 * Only reads environment variables on first call, uses cache thereafter.
 *
 * @returns Shadow configuration
 * @throws If environment variables contain invalid values
 *
 * @example
 * ```typescript
 * const config = getShadowConfig();
 * // => { createdAtField: 'createdAt', updatedAtField: 'updatedAt', stringMaxBytes: 100, numberPadding: 15 }
 * ```
 */
export function getShadowConfig(): ShadowConfig {
  if (!cachedShadowConfig) {
    cachedShadowConfig = {
      createdAtField: process.env.SHADOW_CREATED_AT_FIELD || 'createdAt',
      updatedAtField: process.env.SHADOW_UPDATED_AT_FIELD || 'updatedAt',
      stringMaxBytes: parseInt(process.env.SHADOW_STRING_MAX_BYTES || '100', 10),
      numberPadding: parseInt(process.env.SHADOW_NUMBER_PADDING || '15', 10),
    };

    // バリデーション
    if (cachedShadowConfig.stringMaxBytes <= 0) {
      throw new Error('SHADOW_STRING_MAX_BYTES must be positive');
    }
    if (cachedShadowConfig.numberPadding <= 0 || cachedShadowConfig.numberPadding > 15) {
      throw new Error('SHADOW_NUMBER_PADDING must be between 1 and 15');
    }
  }

  return cachedShadowConfig;
}

/**
 * Clear cache (for testing only)
 *
 * Do not use in production.
 * Only used in test environments to clear cache between tests.
 */
export function clearShadowConfigCache(): void {
  cachedShadowConfig = null;
}
