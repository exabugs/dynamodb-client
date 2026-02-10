/**
 * 共通型定義
 *
 * OpenAPI generated types を SSOT として使用します。
 */
// OpenAPI generated types をインポート
import type { components } from '../../__generated__/openapi.js';

// Client SDK types を re-export
export type Filter<T> = components['schemas']['Filter'] & {
  [P in keyof T]?: T[P] | components['schemas']['FilterOperators'];
};

export type FilterOperators = components['schemas']['FilterOperators'];
export type UpdateOperators<T> = components['schemas']['UpdateOperators'] & {
  $set?: Partial<T>;
  $setOnInsert?: Partial<T>;
  $unset?: (keyof T)[];
  $inc?: Partial<Record<keyof T, number>>;
};

export type FindOptions = components['schemas']['FindOptions'];
export type UpdateOneOptions = components['schemas']['UpdateOneOptions'];
export type UpdateManyOptions = components['schemas']['UpdateManyOptions'];

export type InsertOneResult = components['schemas']['InsertOneResult'];
export type InsertManyResult = components['schemas']['InsertManyResult'];
export type UpdateResult = components['schemas']['UpdateResult'];
export type DeleteResult = components['schemas']['DeleteResult'];

// ConsumedCapacity型定義
export * from './consumed-capacity.js';
