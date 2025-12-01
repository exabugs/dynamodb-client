/**
 * サーバーサイドシャドウ設定管理
 *
 * シャドー設定を環境変数から読み込み、グローバル変数にキャッシュします。
 * 設定はTerraformデプロイ時に環境変数として埋め込まれるため、
 * 実行時のI/Oが不要で、最も高速かつシンプルです。
 *
 * キャッシュの動作:
 * - 初回呼び出し時: 環境変数からパースしてキャッシュ
 * - 2回目以降: キャッシュから即座に取得
 * - キャッシュ有効期間: Lambda実行環境が存在する間（通常15分〜数時間）
 *
 * 設定変更の反映:
 * - packages/api-types/shadow.config.jsonを変更
 * - Terraformで再度apply（環境変数が更新される）
 * - Lambda関数が自動的に再デプロイされ、新しい設定が反映される
 *
 * 要件: 8.7
 */
import type { ShadowSchema } from './generator.js';
import type { ShadowFieldConfig } from './types.js';

/**
 * シャドー設定の全体構造
 */
export interface ShadowConfig {
  /** スキーマバージョン */
  $schemaVersion: string;
  /** 生成日時 */
  $generatedAt?: string;
  /** 生成元ファイル */
  $generatedFrom?: string;
  /** データベース設定 */
  database?: {
    name: string;
    timestamps?: {
      createdAt: string;
      updatedAt: string;
    };
  };
  /** リソースごとの設定 */
  resources: {
    [resourceName: string]: {
      /** ソート可能なフィールド定義 */
      shadows: {
        [fieldName: string]: {
          /** フィールドの型 */
          type: 'string' | 'number' | 'datetime' | 'boolean';
        };
      };
      /** デフォルトソート設定 */
      sortDefaults: {
        field: string;
        order: 'ASC' | 'DESC';
      };
      /** TTL設定（オプション） */
      ttl?: {
        days: number;
      };
    };
  };
}

/**
 * グローバル変数にキャッシュ（Lambda実行環境で再利用）
 */
let cachedShadowConfig: ShadowConfig | null = null;

/**
 * シャドー設定を取得（キャッシュ付き）
 *
 * 環境変数SHADOW_CONFIGからbase64エンコードされたJSON文字列をデコードしてパースして取得。
 * 初回呼び出し時のみパース処理を行い、以降はキャッシュを使用。
 *
 * @returns シャドー設定
 * @throws 環境変数が未設定、または不正な形式の場合
 *
 * @example
 * ```typescript
 * const config = getShadowConfig();
 * const articleSchema = getResourceSchema(config, 'articles');
 * const shadows = generateShadowRecords(record, articleSchema);
 * ```
 */
export function getShadowConfig(): ShadowConfig {
  if (!cachedShadowConfig) {
    const configBase64 = process.env.SHADOW_CONFIG;

    if (!configBase64) {
      throw new Error('SHADOW_CONFIG environment variable is not set');
    }

    try {
      // Base64デコード
      const configJson = Buffer.from(configBase64, 'base64').toString('utf-8');
      cachedShadowConfig = JSON.parse(configJson) as ShadowConfig;

      // 基本的なバリデーション
      if (!cachedShadowConfig.$schemaVersion) {
        throw new Error('Missing $schemaVersion in shadow config');
      }

      if (!cachedShadowConfig.resources || typeof cachedShadowConfig.resources !== 'object') {
        throw new Error('Missing or invalid resources in shadow config');
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in SHADOW_CONFIG environment variable: ${error.message}`);
      }
      throw error;
    }
  }

  return cachedShadowConfig;
}

/**
 * 特定のリソースのシャドースキーマを取得する
 *
 * @param config - シャドー設定全体
 * @param resourceName - リソース名（例: 'articles', 'tasks'）
 * @returns シャドースキーマ
 * @throws リソースが設定に存在しない場合
 *
 * @example
 * ```typescript
 * const config = getShadowConfig();
 * const schema = getResourceSchema(config, 'articles');
 * // => { resource: 'articles', sortableFields: { name: { type: 'string' }, ... } }
 * ```
 */
export function getResourceSchema(config: ShadowConfig, resourceName: string): ShadowSchema {
  const resourceConfig = config.resources[resourceName];

  if (!resourceConfig) {
    throw new Error(`Resource '${resourceName}' not found in shadow config`);
  }

  return {
    resource: resourceName,
    sortableFields: resourceConfig.shadows,
  };
}

/**
 * 設定ハッシュを取得
 *
 * レコード作成時にメタデータとして保存するために使用。
 * SHADOW_CONFIG環境変数（base64エンコードされたJSON）からSHA-256ハッシュを生成する。
 *
 * @returns 設定ハッシュ（SHA-256）
 */
export function getShadowConfigHash(): string {
  // 設定をロード（キャッシュされていなければロードされる）
  getShadowConfig();

  // 環境変数 SHADOW_CONFIG は Terraform により base64 エンコードされた JSON として設定される
  // この値をハッシュ化することで、設定の変更を検知できる
  const configBase64 = process.env.SHADOW_CONFIG;
  if (!configBase64) {
    throw new Error('SHADOW_CONFIG environment variable is not set');
  }

  // Node.js の crypto モジュールを使用してハッシュを計算
  // Lambda 環境では crypto は標準モジュール
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256').update(configBase64).digest('hex');
  return hash;
}

/**
 * スキーマバージョンを取得
 *
 * レコード作成時にメタデータとして保存するために使用。
 *
 * @returns スキーマバージョン
 */
export function getSchemaVersion(): string {
  const config = getShadowConfig();
  return config.$schemaVersion;
}

/**
 * キャッシュをクリアする（テスト用）
 *
 * 本番環境では使用しないこと。
 * テスト環境でのみ、テスト間でキャッシュをクリアするために使用。
 */
export function clearShadowConfigCache(): void {
  cachedShadowConfig = null;
}

/**
 * リソースの全シャドーフィールドを取得する
 *
 * @param config - シャドー設定全体
 * @param resourceName - リソース名
 * @returns 全シャドーフィールドの設定
 */
export function getAllShadowFields(
  config: ShadowConfig,
  resourceName: string
): Record<string, ShadowFieldConfig> {
  const resourceConfig = config.resources[resourceName];

  if (!resourceConfig) {
    throw new Error(`Resource '${resourceName}' not found in shadow config`);
  }

  return resourceConfig.shadows;
}

/**
 * 指定されたフィールドが有効なシャドーフィールドかどうかを検証する
 *
 * @param config - シャドー設定全体
 * @param resourceName - リソース名
 * @param fieldName - 検証するフィールド名
 * @returns フィールドが有効な場合true
 */
export function isValidShadowField(
  config: ShadowConfig,
  resourceName: string,
  fieldName: string
): boolean {
  try {
    const allFields = getAllShadowFields(config, resourceName);
    return fieldName in allFields;
  } catch {
    return false;
  }
}

/**
 * リソースのデフォルトソート設定を取得する
 *
 * @param config - シャドー設定全体
 * @param resourceName - リソース名
 * @returns デフォルトソート設定
 */
export function getDefaultSort(
  config: ShadowConfig,
  resourceName: string
): { field: string; order: 'ASC' | 'DESC' } {
  const resourceConfig = config.resources[resourceName];

  if (!resourceConfig) {
    throw new Error(`Resource '${resourceName}' not found in shadow config`);
  }

  return resourceConfig.sortDefaults;
}
