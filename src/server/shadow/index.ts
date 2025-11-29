/**
 * シャドー管理モジュール
 *
 * DynamoDB Single-Table設計における動的シャドーレコード管理を提供します。
 */

// 型定義のエクスポート
export type {
  ShadowFieldType,
  ShadowFieldConfig,
  ResourceShadowConfig,
  ShadowConfig,
  ShadowDiff,
} from './types.js';

// ジェネレーター関数と型のエクスポート
export type { ShadowSchema, ShadowRecord } from './generator.js';
export {
  escapeString,
  formatNumber,
  formatDatetime,
  formatBoolean,
  formatFieldValue,
  generateShadowSK,
  generateMainRecordSK,
  generateShadowRecords,
} from './generator.js';

// 差分計算関数のエクスポート
export { calculateShadowDiff, isDiffEmpty, mergeShadowDiffs } from './differ.js';

// 設定管理関数のエクスポート
export {
  getShadowConfig,
  getResourceSchema,
  getShadowConfigHash,
  getSchemaVersion,
  clearShadowConfigCache,
  getAllShadowFields,
  isValidShadowField,
  getDefaultSort,
} from './config.js';
