// 共通モジュールを再エクスポート
export * from './shared/index.js';

// クライアントAPI
export { Database, Collection } from './client/index.js';

// サーバーサイド機能
export {
  convertFilterToDynamo,
  type DynamoComparisonOperator,
  type DynamoCondition,
  type DynamoQuery,
  generateShadowRecords,
  type ShadowRecord,
  getShadowConfig,
  clearShadowConfigCache,
  type ShadowConfig,  // v0.3.x environment variable-based configuration
} from './server/index.js';
