/**
 * Assertion Helpers
 *
 * テスト用のアサーションヘルパー
 * 一貫した検証を提供します
 */
import { expect } from 'vitest';

import type {
  DeleteManyResult,
  InsertManyResult,
  OperationError,
  UpdateManyResult,
} from '../../src/server/types.js';
import { ItemNotFoundError } from '../../src/shared/index.js';

/**
 * アサーションヘルパー
 */
export const assertionHelpers = {
  /**
   * InsertManyResult の構造を検証
   *
   * @param result - InsertManyResult
   * @param expectedCount - 期待される成功件数
   */
  assertInsertManyResult(result: InsertManyResult, expectedCount: number): void {
    expect(result).toHaveProperty('count');
    expect(result).toHaveProperty('successIds');
    expect(result).toHaveProperty('failedIds');
    expect(result).toHaveProperty('errors');
    expect(result.count).toBe(expectedCount);
    expect(typeof result.successIds).toBe('object');
    expect(typeof result.failedIds).toBe('object');
    expect(typeof result.errors).toBe('object');
  },

  /**
   * UpdateManyResult の構造を検証
   *
   * @param result - UpdateManyResult
   * @param expectedCount - 期待される成功件数
   */
  assertUpdateManyResult(result: UpdateManyResult, expectedCount: number): void {
    expect(result).toHaveProperty('count');
    expect(result).toHaveProperty('successIds');
    expect(result).toHaveProperty('failedIds');
    expect(result).toHaveProperty('errors');
    expect(result.count).toBe(expectedCount);
    expect(typeof result.successIds).toBe('object');
    expect(typeof result.failedIds).toBe('object');
    expect(typeof result.errors).toBe('object');
  },

  /**
   * DeleteManyResult の構造を検証
   *
   * @param result - DeleteManyResult
   * @param expectedCount - 期待される成功件数
   */
  assertDeleteManyResult(result: DeleteManyResult, expectedCount: number): void {
    expect(result).toHaveProperty('count');
    expect(result).toHaveProperty('successIds');
    expect(result).toHaveProperty('failedIds');
    expect(result).toHaveProperty('errors');
    expect(result.count).toBe(expectedCount);
    expect(typeof result.successIds).toBe('object');
    expect(typeof result.failedIds).toBe('object');
    expect(typeof result.errors).toBe('object');
  },

  /**
   * OperationError の構造を検証
   *
   * @param error - OperationError
   * @param expectedId - 期待されるレコードID
   * @param expectedCode - 期待されるエラーコード
   */
  assertOperationError(error: OperationError, expectedId: string, expectedCode: string): void {
    expect(error).toHaveProperty('id');
    expect(error).toHaveProperty('code');
    expect(error).toHaveProperty('message');
    expect(error.id).toBe(expectedId);
    expect(error.code).toBe(expectedCode);
    expect(typeof error.message).toBe('string');
  },

  /**
   * ItemNotFoundError がスローされたことを検証
   *
   * @param error - エラーオブジェクト
   * @param expectedId - 期待されるレコードID
   */
  assertItemNotFoundError(error: unknown, expectedId: string): void {
    expect(error).toBeInstanceOf(ItemNotFoundError);
    if (error instanceof ItemNotFoundError) {
      expect(error.message).toContain(expectedId);
      expect(error.code).toBe('ITEM_NOT_FOUND');
      expect(error.statusCode).toBe(404);
    }
  },

  /**
   * 部分失敗レスポンスの構造を検証
   *
   * @param result - バルク操作の結果
   * @param expectedSuccessCount - 期待される成功件数
   * @param expectedFailureCount - 期待される失敗件数
   */
  assertPartialFailure(
    result: InsertManyResult | UpdateManyResult | DeleteManyResult,
    expectedSuccessCount: number,
    expectedFailureCount: number
  ): void {
    expect(result.count).toBe(expectedSuccessCount);
    expect(Object.keys(result.successIds).length).toBe(expectedSuccessCount);
    expect(Object.keys(result.failedIds).length).toBe(expectedFailureCount);
    expect(Object.keys(result.errors).length).toBe(expectedFailureCount);

    // failedIds と errors のキーが一致することを確認
    const failedIdKeys = Object.keys(result.failedIds);
    const errorKeys = Object.keys(result.errors);
    expect(failedIdKeys.sort()).toEqual(errorKeys.sort());
  },

  /**
   * 完全失敗レスポンスの構造を検証
   *
   * @param result - バルク操作の結果
   * @param expectedFailureCount - 期待される失敗件数
   */
  assertCompleteFailure(
    result: InsertManyResult | UpdateManyResult | DeleteManyResult,
    expectedFailureCount: number
  ): void {
    expect(result.count).toBe(0);
    expect(Object.keys(result.successIds).length).toBe(0);
    expect(Object.keys(result.failedIds).length).toBe(expectedFailureCount);
    expect(Object.keys(result.errors).length).toBe(expectedFailureCount);
  },
};
