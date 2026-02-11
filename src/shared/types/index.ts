/**
 * 共通型定義
 *
 * OpenAPI generated types を SSOT として使用します。
 */
import type {
  DeleteResult as GeneratedDeleteResult,
  Filter as GeneratedFilter,
  FilterOperators,
  FindOptions,
  InsertManyResult as GeneratedInsertManyResult,
  InsertOneResult as GeneratedInsertOneResult,
  UpdateManyOptions,
  UpdateOneOptions,
  UpdateOperators as GeneratedUpdateOperators,
  UpdateResult as GeneratedUpdateResult,
} from '../../__generated__/models/index.js';

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

export type { FindOptions, UpdateOneOptions, UpdateManyOptions };
export type InsertOneResult = GeneratedInsertOneResult;
export type InsertManyResult = GeneratedInsertManyResult;
export type UpdateResult = GeneratedUpdateResult;
export type DeleteResult = GeneratedDeleteResult;

// ConsumedCapacity型定義
export * from './consumed-capacity.js';
