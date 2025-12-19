/**
 * シャドー管理モジュール
 *
 * DynamoDB Single-Table設計における動的シャドーレコード管理を提供します。
 */

// 型定義のエクスポート
export type {
  ShadowFieldType,
  ShadowFieldConfig,
  ShadowDiff,
} from './types.js';

// v0.3.x configuration types
export type { ShadowConfig } from './config.js';

// ジェネレーター関数と型のエクスポート
export type { ShadowRecord } from './generator.js';
export {
  escapeString,
  formatDatetime,
  formatBoolean,
  formatFieldValue,
  generateMainRecordSK,
  generateShadowRecords,
  formatNumberWithOffset,
  truncateString,
  normalizeJson,
} from './generator.js';

// 差分計算関数のエクスポート
export { calculateShadowDiff, isDiffEmpty, mergeShadowDiffs } from './differ.js';

// 設定管理関数のエクスポート
export {
  getShadowConfig,
  clearShadowConfigCache,
} from './config.js';

// 型推論関数のエクスポート
export {
  inferFieldType,
  extractShadowableFields,
} from './typeInference.js';
