/**
 * Records Lambda API型定義
 * Lambda Function URL (RPC スタイル) で使用される型定義
 * MongoDB 風の操作インターフェース
 */

// ========================================
// リクエスト型
// ========================================

/**
 * API操作タイプ（MongoDB 風）
 */
export type ApiOperation =
  // Query operations
  | 'find' // リスト取得（フィルター・ソート・ページネーション）
  | 'findOne' // 単一レコード取得
  | 'findMany' // 複数レコード取得（ID指定）
  | 'findManyReference' // 参照レコード取得（外部キー）
  // Mutation operations
  | 'insertOne' // 単一レコード作成
  | 'updateOne' // 単一レコード更新
  | 'updateMany' // 複数レコード一括更新
  | 'deleteOne' // 単一レコード削除
  | 'deleteMany' // 複数レコード一括削除
  | 'insertMany'; // 複数レコード一括作成

/**
 * API リクエスト（共通）
 */
export interface ApiRequest<T = unknown> {
  /** 操作名 */
  op: ApiOperation;
  /** リソース名（例: "articles", "tasks"） */
  resource: string;
  /** 操作パラメータ */
  params: T;
}

/**
 * find パラメータ
 */
export interface FindParams {
  /** フィルター条件 */
  filter?: Record<string, unknown>;
  /** ソート条件 */
  sort?: {
    /** ソート対象フィールド名（シャドー名） */
    field: string;
    /** ソート順序（ASC: 昇順, DESC: 降順） */
    order: 'ASC' | 'DESC';
  };
  /** ページネーション条件 */
  pagination?: {
    /** ページ番号（1始まり） */
    page?: number;
    /** 1ページあたりの件数（最大50件） */
    perPage?: number;
    /** 次ページトークン（Base64URL エンコード） */
    nextToken?: string;
  };
}

/**
 * findOne パラメータ
 */
export interface FindOneParams {
  /** 取得するレコードのID */
  id: string;
}

/**
 * findMany パラメータ
 */
export interface FindManyParams {
  /** 取得するレコードのIDリスト */
  ids: string[];
}

/**
 * findManyReference パラメータ
 */
export interface FindManyReferenceParams {
  /** 参照フィールド名（例: "userId"） */
  target: string;
  /** 参照先ID */
  id: string;
  /** フィルター条件 */
  filter?: Record<string, unknown>;
  /** ソート条件 */
  sort?: {
    field: string;
    order: 'ASC' | 'DESC';
  };
  /** ページネーション条件 */
  pagination?: {
    page?: number;
    perPage?: number;
    nextToken?: string;
  };
}

/**
 * insertOne パラメータ
 */
export interface InsertOneParams {
  /** 作成するレコードのデータ */
  data: Record<string, unknown>;
}

/**
 * updateOne パラメータ
 */
export interface UpdateOneParams {
  /** 更新対象のレコードID */
  id: string;
  /** 更新データ（JSON Merge Patch形式） */
  data: Record<string, unknown>;
}

/**
 * updateMany パラメータ
 */
export interface UpdateManyParams {
  /** 更新対象のレコードIDリスト */
  ids: string[];
  /** 更新データ（JSON Merge Patch形式） */
  data: Record<string, unknown>;
}

/**
 * deleteOne パラメータ
 */
export interface DeleteOneParams {
  /** 削除対象のレコードID */
  id: string;
}

/**
 * deleteMany パラメータ
 */
export interface DeleteManyParams {
  /** 削除対象のレコードIDリスト */
  ids: string[];
}

/**
 * insertMany パラメータ
 */
export interface InsertManyParams {
  /** 作成するレコードのデータ配列 */
  data: Record<string, unknown>[];
}

// ========================================
// レスポンス型
// ========================================

/**
 * API 成功レスポンス
 */
export interface ApiSuccessResponse<T> {
  /** 成功フラグ */
  success: true;
  /** レスポンスデータ */
  data: T;
}

/**
 * API エラーレスポンス
 */
export interface ApiErrorResponse {
  /** 成功フラグ */
  success: false;
  /** エラー情報 */
  error: {
    /** エラーコード */
    code: string;
    /** エラーメッセージ */
    message: string;
    /** HTTPステータスコード */
    statusCode: number;
    /** 追加詳細情報（オプション） */
    details?: unknown;
  };
}

/**
 * API レスポンス（共通）
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ========================================
// データ型
// ========================================

/**
 * find レスポンスデータ
 */
export interface FindResult {
  /** レコードリスト */
  items: Record<string, unknown>[];
  /** ページ情報 */
  pageInfo: {
    /** 次ページが存在するか */
    hasNextPage: boolean;
    /** 前ページが存在するか */
    hasPreviousPage: boolean;
  };
  /** 次ページトークン（存在する場合） */
  nextToken?: string;
  /** 総件数（オプション、パフォーマンス影響あり） */
  total?: number;
}

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
export interface FindManyReferenceResult {
  /** レコードリスト */
  items: Record<string, unknown>[];
  /** ページ情報 */
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  /** 次ページトークン（存在する場合） */
  nextToken?: string;
  /** 総件数（オプション） */
  total?: number;
}

/**
 * insertOne レスポンスデータ
 */
export type InsertOneResult = Record<string, unknown>;

/**
 * updateOne レスポンスデータ
 */
export type UpdateOneResult = Record<string, unknown>;

/**
 * 操作エラー
 * 部分失敗時の個別エラー情報
 */
export interface OperationError {
  /** エラーが発生したレコードのID */
  id: string;
  /** エラーコード */
  code: string;
  /** エラーメッセージ */
  message: string;
}

/**
 * バルク操作の統一レスポンス形式（Records Lambda内部形式）
 *
 * Records Lambdaは統一された内部形式でレスポンスを返却します。
 * この形式は情報を保持し、Collection.tsでMongoDB互換形式に変換されます。
 */
export interface BulkOperationResult {
  /** 成功件数 */
  count: number;
  /** 成功したレコードのインデックスとID（{ 0: 'A', 2: 'C' }） */
  successIds: Record<number, string>;
  /** 失敗したレコードのインデックス（{ 1: 'B' }） */
  failedIds: Record<number, string>;
  /** エラー情報（インデックスをキーとする）（{ 1: { code: '...', message: '...' } }） */
  errors: Record<number, OperationError>;
}

/**
 * updateMany レスポンスデータ（Records Lambda内部形式）
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface UpdateManyResult extends BulkOperationResult {}

/**
 * deleteOne レスポンスデータ
 */
export interface DeleteOneResult {
  /** 削除されたレコードのID */
  id: string;
}

/**
 * deleteMany レスポンスデータ（Records Lambda内部形式）
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface DeleteManyResult extends BulkOperationResult {}

/**
 * insertMany レスポンスデータ（Records Lambda内部形式）
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface InsertManyResult extends BulkOperationResult {}

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
