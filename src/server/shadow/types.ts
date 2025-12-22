/**
 * シャドー管理の型定義
 * 
 * shadows層の型定義を再エクスポートし、server層固有の型を追加します。
 */

// shadows層の型定義を再エクスポート
export type {
  ShadowFieldType,
  ShadowFieldConfig,
  ShadowDiff,
} from '../../shadows/index.js';
