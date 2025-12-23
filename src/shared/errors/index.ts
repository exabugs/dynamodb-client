/**
 * 統一されたエラー階層
 * 
 * プロジェクト全体で使用されるエラークラスを提供します。
 * 一貫したエラーハンドリングパターンを実現します。
 */

/**
 * エラーコード定義
 */
export enum ErrorCode {
  /** 認証エラー（JWT検証失敗、署名不正、期限切れなど） */
  AUTH_ERROR = 'AUTH_ERROR',
  /** 設定エラー（環境変数未設定、shadow.config読み込み失敗など） */
  CONFIG_ERROR = 'CONFIG_ERROR',
  /** 無効なフィルター（sort.fieldが無効なシャドー名） */
  INVALID_FILTER = 'INVALID_FILTER',
  /** 無効なトークン（nextTokenデコード失敗） */
  INVALID_TOKEN = 'INVALID_TOKEN',
  /** アイテムが見つからない（指定IDのレコードが存在しない） */
  ITEM_NOT_FOUND = 'ITEM_NOT_FOUND',
  /** 部分失敗（TransactWriteItemsの一部が失敗） */
  PARTIAL_FAILURE = 'PARTIAL_FAILURE',
  /** バージョン競合（楽観ロック競合） */
  VERSION_CONFLICT = 'VERSION_CONFLICT',
  /** バリデーションエラー（リクエスト形式不正、必須フィールド不足など） */
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  /** 内部エラー（予期しないサーバーエラー） */
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  /** 未実装エラー（機能が未実装） */
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
  /** 無効な操作（不明な操作名） */
  INVALID_OPERATION = 'INVALID_OPERATION',
  /** 不明なエラー（予期しないエラー） */
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * アプリケーションエラーの基底クラス
 */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * エラーをJSON形式に変換
   */
  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      ...(this.details && { details: this.details }),
    };
  }
}

/**
 * 認証エラー
 * JWT検証失敗、署名不正、期限切れなどで発生
 */
export class AuthError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.AUTH_ERROR, message, 401, details);
  }
}

/**
 * 設定エラー
 * 環境変数未設定、shadow.config読み込み失敗などで発生
 */
export class ConfigError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.CONFIG_ERROR, message, 500, details);
  }
}

/**
 * 無効なフィルターエラー
 * sort.fieldが無効なシャドー名の場合に発生
 */
export class InvalidFilterError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.INVALID_FILTER, message, 400, details);
  }
}

/**
 * 無効なトークンエラー
 * nextTokenのデコードに失敗した場合に発生
 */
export class InvalidTokenError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.INVALID_TOKEN, message, 400, details);
  }
}

/**
 * アイテムが見つからないエラー
 * 指定IDのレコードが存在しない場合に発生
 */
export class ItemNotFoundError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.ITEM_NOT_FOUND, message, 404, details);
  }
}

/**
 * 部分失敗エラー
 * TransactWriteItemsの一部が失敗した場合に発生
 */
export class PartialFailureError extends AppError {
  constructor(
    message: string,
    public readonly failedIds: string[],
    public readonly errors: Array<{ id: string; code: string; message: string }>,
    details?: Record<string, unknown>
  ) {
    super(ErrorCode.PARTIAL_FAILURE, message, 207, {
      ...details,
      failedIds,
      errors,
    });
  }
}

/**
 * バージョン競合エラー
 * 楽観ロック競合が発生した場合に発生
 */
export class VersionConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.VERSION_CONFLICT, message, 409, details);
  }
}

/**
 * エラーがAppErrorのインスタンスかどうかを判定
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * エラーコードからエラークラスを取得
 */
export function getErrorClass(
  code: ErrorCode
): new (message: string, details?: Record<string, unknown>) => AppError {
  switch (code) {
    case ErrorCode.AUTH_ERROR:
      return AuthError;
    case ErrorCode.CONFIG_ERROR:
      return ConfigError;
    case ErrorCode.INVALID_FILTER:
      return InvalidFilterError;
    case ErrorCode.INVALID_TOKEN:
      return InvalidTokenError;
    case ErrorCode.ITEM_NOT_FOUND:
      return ItemNotFoundError;
    case ErrorCode.VERSION_CONFLICT:
      return VersionConflictError;
    default:
      return AppError as never;
  }
}