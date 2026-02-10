/**
 * updateOne操作の直接テスト
 *
 * ADR 001: 最小限のレスポンスデータ（セキュリティ重視）
 * - updateOneは { id, ...更新したフィールドのみ } を返す
 * - findOneの追加クエリは実行しない（セキュリティとパフォーマンス）
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as updateManyModule from '../../src/server/operations/updateMany.js';
import { handleUpdateOne } from '../../src/server/operations/updateOne.js';
import { errorSimulator } from '../helpers/error-simulators.js';
import { updateManyResultBuilder } from '../helpers/response-builders.js';

// updateManyをモック
vi.mock('../../src/server/operations/updateMany.js', () => ({
  handleUpdateMany: vi.fn(),
}));

describe('updateOne - 直接テスト', () => {
  const requestId = 'test-request-id';
  const resource = 'articles';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('idが指定された場合', () => {
    it('updateMany([id], data)を呼び出して { id, ...更新フィールド } を返す', async () => {
      const testId = 'article-001';
      const testData = {
        title: '更新後のタイトル',
        status: 'published',
      };

      // updateManyのモックレスポンス（Response Builderを使用、更新したフィールドを含む）
      const mockUpdateManyResponse = updateManyResultBuilder.success(1, [testId], testData);

      vi.mocked(updateManyModule.handleUpdateMany).mockResolvedValue(mockUpdateManyResponse);

      // updateOneを実行
      const result = await handleUpdateOne(
        resource,
        {
          id: testId,
          data: testData,
        },
        requestId
      );

      // updateManyが正しく呼び出されたことを確認
      expect(updateManyModule.handleUpdateMany).toHaveBeenCalledWith(
        resource,
        {
          ids: [testId],
          data: testData,
        },
        requestId
      );

      // 結果が { acknowledged, matchedCount, modifiedCount, id, ...更新したフィールドのみ } であることを確認
      expect(result).toMatchObject({
        acknowledged: true,
        matchedCount: 1,
        modifiedCount: 1,
        id: testId,
        title: '更新後のタイトル',
        status: 'published',
      });

      // 更新していないフィールド（content, createdAt等）は含まれない
      expect(result).not.toHaveProperty('content');
      expect(result).not.toHaveProperty('createdAt');
      expect(result).not.toHaveProperty('updatedAt');
    });

    it('UpdateOperators形式（$set）の場合、$setのフィールドのみを返す', async () => {
      const testId = 'article-002';
      const testData = {
        $set: {
          title: '更新後のタイトル',
        },
        $setOnInsert: {
          createdAt: '2025-01-01T00:00:00Z',
        },
      };

      // updateManyのモックレスポンス（$setのフィールドのみを含む）
      const mockUpdateManyResponse = updateManyResultBuilder.success(1, [testId], {
        title: '更新後のタイトル',
      });

      vi.mocked(updateManyModule.handleUpdateMany).mockResolvedValue(mockUpdateManyResponse);

      // updateOneを実行
      const result = await handleUpdateOne(
        resource,
        {
          id: testId,
          data: testData,
        },
        requestId
      );

      // 結果が { acknowledged, matchedCount, modifiedCount, id, ...$setのフィールドのみ } であることを確認
      expect(result).toMatchObject({
        acknowledged: true,
        matchedCount: 1,
        modifiedCount: 1,
        id: testId,
        title: '更新後のタイトル',
      });

      // $setOnInsertのフィールドは含まれない
      expect(result).not.toHaveProperty('createdAt');
    });

    it('更新が失敗した場合はErrorをスローする', async () => {
      const testId = 'article-001';
      const testData = {
        title: '更新後のタイトル',
      };

      // updateManyのモックレスポンス（失敗、Response Builderを使用）
      const mockUpdateManyResponse = updateManyResultBuilder.failure([testId], {
        0: errorSimulator.operationError(testId, 'NOT_FOUND', 'Record not found'),
      });

      vi.mocked(updateManyModule.handleUpdateMany).mockResolvedValue(mockUpdateManyResponse);

      // updateOneを実行してエラーを確認
      await expect(
        handleUpdateOne(
          resource,
          {
            id: testId,
            data: testData,
          },
          requestId
        )
      ).rejects.toThrow('Failed to update record');
    });
  });

  describe('filterが指定された場合', () => {
    it('updateMany({ filter }, data)を呼び出して { id, ...更新フィールド } を返す', async () => {
      const testFilter = { status: 'draft' };
      const testData = {
        status: 'published',
      };

      // updateManyのモックレスポンス（Response Builderを使用、更新したフィールドを含む）
      const mockUpdateManyResponse = updateManyResultBuilder.success(1, ['article-002'], testData);

      vi.mocked(updateManyModule.handleUpdateMany).mockResolvedValue(mockUpdateManyResponse);

      // updateOneを実行
      const result = await handleUpdateOne(
        resource,
        {
          filter: testFilter,
          data: testData,
        },
        requestId
      );

      // updateManyが正しく呼び出されたことを確認
      expect(updateManyModule.handleUpdateMany).toHaveBeenCalledWith(
        resource,
        {
          filter: testFilter,
          data: testData,
        },
        requestId
      );

      // 結果が { acknowledged, matchedCount, modifiedCount, id, ...更新したフィールドのみ } であることを確認
      expect(result).toMatchObject({
        acknowledged: true,
        matchedCount: 1,
        modifiedCount: 1,
        id: 'article-002',
        status: 'published',
      });

      // 更新していないフィールドは含まれない
      expect(result).not.toHaveProperty('title');
      expect(result).not.toHaveProperty('content');
    });
  });
});
