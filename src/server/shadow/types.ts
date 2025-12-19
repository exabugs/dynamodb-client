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

// Legacy shadow configuration types removed in v0.3.x
// Use environment variables for configuration instead

/**
 * シャドー差分計算の結果
 */
export interface ShadowDiff {
  /** 削除すべきシャドーSKのリスト */
  toDelete: string[];
  /** 追加すべきシャドーSKのリスト */
  toAdd: string[];
}
