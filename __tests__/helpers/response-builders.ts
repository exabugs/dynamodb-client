/**
 * Response Builders
 *
 * テストモック用のレスポンスビルダー
 * 実際のインターフェースと完全に一致するレスポンスデータを生成します
 */
import type {
  DeleteManyResult,
  FindManyResult,
  FindOneResult,
  InsertManyResult,
  OperationError,
  UpdateManyResult,
} from '../../src/server/types.js';

/**
 * InsertManyResult ビルダー
 */
export const insertManyResultBuilder = {
  /**
   * 成功レスポンスを生成
   *
   * @param count - 成功件数
   * @param ids - 成功したレコードのIDリスト
   * @returns InsertManyResult
   */
  success(count: number, ids: string[]): InsertManyResult {
    const successIds: Record<number, string> = {};
    ids.forEach((id, index) => {
      successIds[index] = id;
    });

    return {
      count,
      successIds,
      failedIds: {},
      errors: {},
    };
  },

  /**
   * 部分失敗レスポンスを生成
   *
   * @param successIds - 成功したレコードのインデックスとID
   * @param failedIds - 失敗したレコードのインデックスとID
   * @param errors - エラー情報
   * @returns InsertManyResult
   */
  partialFailure(
    successIds: Record<number, string>,
    failedIds: Record<number, string>,
    errors: Record<number, OperationError>
  ): InsertManyResult {
    return {
      count: Object.keys(successIds).length,
      successIds,
      failedIds,
      errors,
    };
  },

  /**
   * 完全失敗レスポンスを生成
   *
   * @param ids - 失敗したレコードのIDリスト
   * @param errors - エラー情報
   * @returns InsertManyResult
   */
  failure(ids: string[], errors: Record<number, OperationError>): InsertManyResult {
    const failedIds: Record<number, string> = {};
    ids.forEach((id, index) => {
      failedIds[index] = id;
    });

    return {
      count: 0,
      successIds: {},
      failedIds,
      errors,
    };
  },
};

/**
 * UpdateManyResult ビルダー
 */
export const updateManyResultBuilder = {
  /**
   * 成功レスポンスを生成（ADR 001: 更新したフィールドのみを返却）
   *
   * @param count - 成功件数
   * @param ids - 成功したレコードのIDリスト
   * @param updatedFields - 更新したフィールド（オプション）
   * @returns UpdateManyResult
   */
  success(count: number, ids: string[], updatedFields?: Record<string, unknown>): UpdateManyResult {
    const successIds: Record<number, string> = {};
    const items: Array<Record<string, unknown>> = [];

    ids.forEach((id, index) => {
      successIds[index] = id;
      // ADR 001: 更新したフィールドのみを含むレコードを追加
      items.push({
        id,
        ...(updatedFields || {}),
      });
    });

    return {
      count,
      successIds,
      failedIds: {},
      errors: {},
      items,
    };
  },

  /**
   * 部分失敗レスポンスを生成
   *
   * @param successIds - 成功したレコードのインデックスとID
   * @param failedIds - 失敗したレコードのインデックスとID
   * @param errors - エラー情報
   * @param items - 成功したレコードのデータ（更新したフィールドのみ）
   * @returns UpdateManyResult
   */
  partialFailure(
    successIds: Record<number, string>,
    failedIds: Record<number, string>,
    errors: Record<number, OperationError>,
    items?: Array<Record<string, unknown>>
  ): UpdateManyResult {
    return {
      count: Object.keys(successIds).length,
      successIds,
      failedIds,
      errors,
      items,
    };
  },

  /**
   * 完全失敗レスポンスを生成
   *
   * @param ids - 失敗したレコードのIDリスト
   * @param errors - エラー情報
   * @returns UpdateManyResult
   */
  failure(ids: string[], errors: Record<number, OperationError>): UpdateManyResult {
    const failedIds: Record<number, string> = {};
    ids.forEach((id, index) => {
      failedIds[index] = id;
    });

    return {
      count: 0,
      successIds: {},
      failedIds,
      errors,
      items: [],
    };
  },
};

/**
 * DeleteManyResult ビルダー
 */
export const deleteManyResultBuilder = {
  /**
   * 成功レスポンスを生成
   *
   * @param count - 成功件数
   * @param ids - 成功したレコードのIDリスト
   * @returns DeleteManyResult
   */
  success(count: number, ids: string[]): DeleteManyResult {
    const successIds: Record<number, string> = {};
    ids.forEach((id, index) => {
      successIds[index] = id;
    });

    return {
      count,
      successIds,
      failedIds: {},
      errors: {},
    };
  },

  /**
   * 部分失敗レスポンスを生成
   *
   * @param successIds - 成功したレコードのインデックスとID
   * @param failedIds - 失敗したレコードのインデックスとID
   * @param errors - エラー情報
   * @returns DeleteManyResult
   */
  partialFailure(
    successIds: Record<number, string>,
    failedIds: Record<number, string>,
    errors: Record<number, OperationError>
  ): DeleteManyResult {
    return {
      count: Object.keys(successIds).length,
      successIds,
      failedIds,
      errors,
    };
  },

  /**
   * 完全失敗レスポンスを生成
   *
   * @param ids - 失敗したレコードのIDリスト
   * @param errors - エラー情報
   * @returns DeleteManyResult
   */
  failure(ids: string[], errors: Record<number, OperationError>): DeleteManyResult {
    const failedIds: Record<number, string> = {};
    ids.forEach((id, index) => {
      failedIds[index] = id;
    });

    return {
      count: 0,
      successIds: {},
      failedIds,
      errors,
    };
  },
};

/**
 * FindOneResult ビルダー
 */
export const findOneResultBuilder = {
  /**
   * 成功レスポンスを生成
   *
   * @param record - レコードデータ
   * @returns FindOneResult
   */
  success(record: Record<string, unknown>): FindOneResult {
    return record;
  },
};

/**
 * FindManyResult ビルダー
 */
export const findManyResultBuilder = {
  /**
   * 成功レスポンスを生成
   *
   * @param records - レコードデータの配列
   * @returns FindManyResult
   */
  success(records: Record<string, unknown>[]): FindManyResult {
    return records;
  },

  /**
   * 空の結果を生成
   *
   * @returns FindManyResult
   */
  empty(): FindManyResult {
    return [];
  },
};
