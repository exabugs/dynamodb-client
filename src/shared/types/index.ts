/**
 * 共通型定義
 *
 * OpenAPI generated types を SSOT として使用します。
 */
import type {
  DeleteResult as GeneratedDeleteResult,
  Filter as GeneratedFilter,
  FilterOperators,
  FindOptions as GeneratedFindOptions,
  InsertManyResult as GeneratedInsertManyResult,
  InsertOneResult as GeneratedInsertOneResult,
  UpdateManyOptions,
  UpdateOneOptions,
  UpdateOperators as GeneratedUpdateOperators,
  UpdateResult as GeneratedUpdateResult,
} from '../../__generated__/models/index.js';
import type { ResourceSchema } from './schema.js';

// Client SDK types を re-export
export type Filter<T> = GeneratedFilter & {
  [P in keyof T]?: T[P] | FilterOperators;
};

export type { FilterOperators };
export type UpdateOperators<T> = GeneratedUpdateOperators & {
  $set?: Partial<T>;
  $setOnInsert?: Partial<T>;
  $unset?: (keyof T)[];
  $inc?: Partial<Record<keyof T, number>>;
};

/** FindOptions にスキーマヒントを追加拡張 */
export type FindOptions = GeneratedFindOptions & {
  /** クエリプランナーへのヒント（フィールドのカーディナリティ） */
  schema?: ResourceSchema;
};
export type { UpdateOneOptions, UpdateManyOptions };
export type { ResourceSchema, SchemaConfig } from './schema.js';
export type InsertOneResult = GeneratedInsertOneResult;
export type InsertManyResult = GeneratedInsertManyResult;
export type UpdateResult = GeneratedUpdateResult;
export type DeleteResult = GeneratedDeleteResult;

// ConsumedCapacity型定義
export * from './consumed-capacity.js';
