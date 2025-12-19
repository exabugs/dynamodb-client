/**
 * @exabugs/dynamodb-client/shadows - シャドー管理ライブラリ
 *
 * DynamoDB Single-Table設計における動的シャドーレコード管理を提供します。
 *
 * 主な機能:
 * - シャドーSK生成（string/number/datetime対応）
 * - シャドー差分計算（旧影と新影の比較）
 * - shadow.config.json読み込みと検証
 */

// 型定義のエクスポート
export type { ShadowFieldConfig, ResourceShadowConfig, ShadowConfig, ShadowDiff } from './types.js';

// スキーマ定義のエクスポート
export type { ShadowFieldType } from './schema.js';

// ジェネレーター関数のエクスポート
export {
  escapeString,
  formatNumber,
  formatDatetime,
  formatBoolean,
  formatFieldValue,
  generateShadowSK,
  generateMainRecordSK,
} from './generator.js';

// 差分計算関数のエクスポート
export { calculateShadowDiff, isDiffEmpty, mergeShadowDiffs } from './differ.js';

// 設定管理関数のエクスポート
export {
  loadShadowConfig,
  getResourceConfig,
  getAllShadowFields,
  isValidShadowField,
  getDefaultSort,
  getConfigPathFromEnv,
} from './config.js';
