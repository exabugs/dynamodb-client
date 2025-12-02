/**
 * シャドーフィールドの型定義
 */
export type ShadowFieldType = 'string' | 'number' | 'datetime' | 'boolean' | 'array' | 'object';

/**
 * シャドー設定のフィールド定義
 */
export interface ShadowFieldConfig {
  type: ShadowFieldType;
}

/**
 * リソースごとのシャドー設定
 */
export interface ResourceShadowConfig {
  sortDefaults: {
    field: string;
    order: 'ASC' | 'DESC';
  };
  shadows: {
    [fieldName: string]: ShadowFieldConfig;
  };
  ttl?: {
    days: number;
  };
}

/**
 * shadow.config.jsonの全体構造
 */
export interface ShadowConfig {
  $schemaVersion: string;
  resources: {
    [resourceName: string]: ResourceShadowConfig;
  };
}

/**
 * シャドー差分計算の結果
 */
export interface ShadowDiff {
  /** 削除すべきシャドーSKのリスト */
  toDelete: string[];
  /** 追加すべきシャドーSKのリスト */
  toAdd: string[];
}
