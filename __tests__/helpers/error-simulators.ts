/**
 * Error Simulators
 *
 * テストモック用のエラーシミュレーター
 * 実際のエラークラスを使用してエラーケースをテストします
 */
import type { OperationError } from '../../src/server/types.js';
import {
  AppError,
  ErrorCode,
  ItemNotFoundError,
  PartialFailureError,
} from '../../src/shared/index.js';

/**
 * エラーシミュレーター
 */
export const errorSimulator = {
  /**
   * ItemNotFoundError を生成
   *
   * @param id - レコードID
   * @param resource - リソース名
   * @returns ItemNotFoundError
   */
  itemNotFound(id: string, resource: string): ItemNotFoundError {
    return new ItemNotFoundError(`Record not found: ${id}`, { resource, id });
  },

  /**
   * ValidationError を生成
   *
   * @param message - エラーメッセージ
   * @param details - 詳細情報
   * @returns AppError
   */
  validationError(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(ErrorCode.VALIDATION_ERROR, message, 400, details);
  },

  /**
   * PartialFailureError を生成
   *
   * @param failedIds - 失敗したレコードのIDリスト
   * @param errors - エラー情報
   * @returns PartialFailureError
   */
  partialFailure(
    failedIds: string[],
    errors: Array<{ id: string; code: string; message: string }>
  ): PartialFailureError {
    return new PartialFailureError('Partial failure occurred', failedIds, errors);
  },

  /**
   * OperationError を生成
   *
   * @param id - レコードID
   * @param code - エラーコード
   * @param message - エラーメッセージ
   * @returns OperationError
   */
  operationError(id: string, code: string, message: string): OperationError {
    return {
      id,
      code,
      message,
    };
  },

  /**
   * ConfigError を生成
   *
   * @param message - エラーメッセージ
   * @param details - 詳細情報
   * @returns AppError
   */
  configError(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(ErrorCode.CONFIG_ERROR, message, 500, details);
  },

  /**
   * InternalError を生成
   *
   * @param message - エラーメッセージ
   * @param details - 詳細情報
   * @returns AppError
   */
  internalError(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(ErrorCode.INTERNAL_ERROR, message, 500, details);
  },
};
