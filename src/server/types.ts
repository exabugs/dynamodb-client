/**
 * Records Lambda API型定義
 * Lambda Function URL (RPC スタイル) で使用される型定義
 * MongoDB 風の操作インターフェース
 *
 * NOTE: OpenAPI仕様から型を生成し、実装で使用しています。
 * generated.tsはOpenAPI仕様から自動生成されます。
 */
import type { components } from '../__generated__/openapi.js';

// ========================================
// Client SDK型（OpenAPI生成型を使用）
// ========================================

/**
 * フィルタ演算子（$プレフィックス付き）
 * OpenAPI仕様から生成された型を使用
 */
export type FilterOperators = components['schemas']['FilterOperators'];

// ========================================
// リクエスト型（OpenAPI生成型を使用）
// ========================================

/**
 * API操作タイプ（MongoDB 風）
 * OpenAPI仕様から生成された型を使用
 */
export type ApiOperation = components['schemas']['ApiOperation'];

/**
 * API リクエスト（共通）
 * OpenAPI仕様から生成された型を使用
 */
export type ApiRequest<T = unknown> = Omit<components['schemas']['ApiRequest'], 'params'> & {
  params: T;
};

/**
 * find パラメータ
 * OpenAPI仕様から生成された型を使用
 */
export type FindParams = components['schemas']['FindParams'];

/**
 * findOne パラメータ
 * OpenAPI仕様から生成された型を使用
 */
export type FindOneParams = components['schemas']['FindOneParams'];

/**
 * findMany パラメータ
 * OpenAPI仕様から生成された型を使用
 */
export type FindManyParams = components['schemas']['FindManyParams'];

/**
 * findManyReference パラメータ
 * OpenAPI仕様から生成された型を使用
 */
export type FindManyReferenceParams = components['schemas']['FindManyReferenceParams'];

/**
 * insertOne パラメータ
 * OpenAPI仕様から生成された型を使用
 */
export type InsertOneParams = components['schemas']['InsertOneParams'];

/**
 * 単一レコード特定（IDまたはフィルター）
 * OpenAPI仕様から生成された型を使用
 */
export type SingleRecordSelector = FindOneParams;

/**
 * 複数レコード特定（IDリストまたはフィルター）
 * OpenAPI仕様から生成された型を使用
 */
export type MultipleRecordsSelector = FindManyParams;

/**
 * updateOne パラメータ
 * OpenAPI仕様から生成された型を使用
 */
export type UpdateOneParams = components['schemas']['UpdateOneParams'];

/**
 * updateMany パラメータ
 * OpenAPI仕様から生成された型を使用
 */
export type UpdateManyParams = components['schemas']['UpdateManyParams'];

/**
 * deleteOne パラメータ
 * OpenAPI仕様から生成された型を使用
 */
export type DeleteOneParams = components['schemas']['DeleteOneParams'];

/**
 * deleteMany パラメータ
 * OpenAPI仕様から生成された型を使用
 */
export type DeleteManyParams = components['schemas']['DeleteManyParams'];

/**
 * insertMany パラメータ
 * OpenAPI仕様から生成された型を使用
 */
export type InsertManyParams = components['schemas']['InsertManyParams'];

// ========================================
// レスポンス型
// ========================================

/**
 * API 成功レスポンス
 * OpenAPI仕様から生成された型を使用
 */
export type ApiSuccessResponse<T> = Omit<components['schemas']['ApiSuccessResponse'], 'data'> & {
  data: T;
};

/**
 * API エラーレスポンス
 * OpenAPI仕様から生成された型を使用
 */
export type ApiErrorResponse = components['schemas']['ApiErrorResponse'];

/**
 * API レスポンス（共通）
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ========================================
// データ型（OpenAPI生成型を使用）
// ========================================

/**
 * find レスポンスデータ
 * OpenAPI仕様から生成された型を使用
 */
export type FindResult = components['schemas']['FindResult'];

/**
 * findOne レスポンスデータ
 */
export type FindOneResult = Record<string, unknown>;

/**
 * findMany レスポンスデータ
 */
export type FindManyResult = Record<string, unknown>[];

/**
 * findManyReference レスポンスデータ
 * OpenAPI仕様から生成された型を使用
 */
export type FindManyReferenceResult = components['schemas']['FindManyReferenceResult'];

/**
 * insertOne レスポンスデータ
 * OpenAPI仕様から生成された型を使用
 */
export type InsertOneResult = components['schemas']['InsertOneResult'];

/**
 * updateOne レスポンスデータ
 * OpenAPI仕様から生成された型を使用
 */
export type UpdateOneResult = components['schemas']['UpdateOneResult'];

/**
 * 操作エラー
 * 部分失敗時の個別エラー情報
 * OpenAPI仕様から生成された型を使用
 */
export type OperationError = components['schemas']['OperationError'];

/**
 * バルク操作の統一レスポンス形式（Records Lambda内部形式）
 * OpenAPI仕様から生成された型を使用
 *
 * Records Lambdaは統一された内部形式でレスポンスを返却します。
 * この形式は情報を保持し、Collection.tsでMongoDB互換形式に変換されます。
 *
 * ADR 001: セキュリティ原則
 * - updateMany は更新したフィールドのみを返却する
 * - read権限なしでupdate権限のみの場合の情報漏洩を防止
 */
export type BulkOperationResult = components['schemas']['BulkOperationResult'];

/**
 * updateMany レスポンスデータ（Records Lambda内部形式）
 */
export type UpdateManyResult = BulkOperationResult;

/**
 * deleteOne レスポンスデータ
 * OpenAPI仕様から生成された型を使用
 */
export type DeleteOneResult = components['schemas']['DeleteOneResult'];

/**
 * deleteMany レスポンスデータ（Records Lambda内部形式）
 */
export type DeleteManyResult = BulkOperationResult;

/**
 * insertMany レスポンスデータ（Records Lambda内部形式）
 */
export type InsertManyResult = BulkOperationResult;

// ========================================
// 型ヘルパー
// ========================================

/**
 * 操作ごとのパラメータ型マッピング
 */
export type ApiParamsMap = {
  find: FindParams;
  findOne: FindOneParams;
  findMany: FindManyParams;
  findManyReference: FindManyReferenceParams;
  insertOne: InsertOneParams;
  updateOne: UpdateOneParams;
  updateMany: UpdateManyParams;
  deleteOne: DeleteOneParams;
  deleteMany: DeleteManyParams;
  insertMany: InsertManyParams;
};

/**
 * 操作ごとのレスポンスデータ型マッピング
 */
export type ApiDataMap = {
  find: FindResult;
  findOne: FindOneResult;
  findMany: FindManyResult;
  findManyReference: FindManyReferenceResult;
  insertOne: InsertOneResult;
  updateOne: UpdateOneResult;
  updateMany: UpdateManyResult;
  deleteOne: DeleteOneResult;
  deleteMany: DeleteManyResult;
  insertMany: InsertManyResult;
};

/**
 * 型安全な API リクエスト
 */
export type TypedApiRequest<T extends ApiOperation> = ApiRequest<ApiParamsMap[T]>;

/**
 * 型安全な API レスポンス
 */
export type TypedApiResponse<T extends ApiOperation> = ApiResponse<ApiDataMap[T]>;
