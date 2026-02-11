/**
 * Records Lambda API型定義
 * Lambda Function URL (RPC スタイル) で使用される型定義
 * MongoDB 風の操作インターフェース
 *
 * NOTE: OpenAPI仕様から型を生成し、実装で使用しています。
 */
import type {
  ApiErrorResponse,
  ApiOperation,
  ApiRequest as GeneratedApiRequest,
  ApiSuccessResponse as GeneratedApiSuccessResponse,
  BulkOperationResult,
  DeleteManyParams,
  DeleteOneParams,
  DeleteOneResult,
  FilterOperators,
  FindManyParams,
  FindManyReferenceParams,
  FindManyReferenceResult,
  FindOneParams,
  FindParams,
  FindResult,
  InsertManyParams,
  InsertOneParams,
  InsertOneResult,
  OperationError,
  UpdateManyParams,
  UpdateOneParams,
  UpdateOneResult,
} from '../__generated__/models/index.js';

// ========================================
// Client SDK型（OpenAPI生成型を使用）
// ========================================

/**
 * フィルタ演算子（$プレフィックス付き）
 */
export type { FilterOperators };

// ========================================
// リクエスト型（OpenAPI生成型を使用）
// ========================================

/**
 * API操作タイプ（MongoDB 風）
 */
export type { ApiOperation };

/**
 * API リクエスト（共通）
 */
export type ApiRequest<T = unknown> = Omit<GeneratedApiRequest, 'params'> & {
  params: T;
};

/**
 * find パラメータ
 */
export type { FindParams };

/**
 * findOne パラメータ
 */
export type { FindOneParams };

/**
 * findMany パラメータ
 */
export type { FindManyParams };

/**
 * findManyReference パラメータ
 */
export type { FindManyReferenceParams };

/**
 * insertOne パラメータ
 */
export type { InsertOneParams };

/**
 * 単一レコード特定（IDまたはフィルター）
 */
export type SingleRecordSelector = FindOneParams;

/**
 * 複数レコード特定（IDリストまたはフィルター）
 */
export type MultipleRecordsSelector = FindManyParams;

/**
 * updateOne パラメータ
 */
export type { UpdateOneParams };

/**
 * updateMany パラメータ
 */
export type { UpdateManyParams };

/**
 * deleteOne パラメータ
 */
export type { DeleteOneParams };

/**
 * deleteMany パラメータ
 */
export type { DeleteManyParams };

/**
 * insertMany パラメータ
 */
export type { InsertManyParams };

// ========================================
// レスポンス型
// ========================================

/**
 * API 成功レスポンス
 */
export type ApiSuccessResponse<T> = Omit<GeneratedApiSuccessResponse, 'data'> & {
  data: T;
};

/**
 * API エラーレスポンス
 */
export type { ApiErrorResponse };

/**
 * API レスポンス（共通）
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ========================================
// データ型（OpenAPI生成型を使用）
// ========================================

/**
 * find レスポンスデータ
 */
export type { FindResult };

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
 */
export type { FindManyReferenceResult };

/**
 * insertOne レスポンスデータ
 */
export type { InsertOneResult };

/**
 * updateOne レスポンスデータ
 */
export type { UpdateOneResult };

/**
 * 操作エラー
 * 部分失敗時の個別エラー情報
 */
export type { OperationError };

/**
 * バルク操作の統一レスポンス形式（Records Lambda内部形式）
 *
 * Records Lambdaは統一された内部形式でレスポンスを返却します。
 * この形式は情報を保持し、Collection.tsでMongoDB互換形式に変換されます。
 *
 * ADR 001: セキュリティ原則
 * - updateMany は更新したフィールドのみを返却する
 * - read権限なしでupdate権限のみの場合の情報漏洩を防止
 */
export type { BulkOperationResult };

/**
 * updateMany レスポンスデータ（Records Lambda内部形式）
 */
export type UpdateManyResult = BulkOperationResult;

/**
 * deleteOne レスポンスデータ
 */
export type { DeleteOneResult };

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
