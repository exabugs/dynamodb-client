export { createDynamoDBClient } from './dynamodb.js';
export type { DynamoDBClientConfig } from './dynamodb.js';

export { ulid, ulidWithTime, decodeTime } from './ulid.js';

export { createLogger } from './logger.js';
export type { Logger, LoggerConfig, LogLevel, LogMetadata } from './logger.js';

export {
  ErrorCode,
  AppError,
  AuthError,
  ConfigError,
  InvalidFilterError,
  InvalidTokenError,
  ItemNotFoundError,
  PartialFailureError,
  VersionConflictError,
  isAppError,
  getErrorClass,
} from './errors.js';

export type {
  FilterOperators,
  Filter,
  UpdateOperators,
  FindOptions,
  InsertOneResult,
  InsertManyResult,
  UpdateResult,
  DeleteResult,
} from './types.js';

export { Database, Collection } from './client/index.js';

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
