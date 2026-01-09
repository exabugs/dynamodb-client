/**
 * deleteOne操作の直接テスト
 *
 * deleteOneがdeleteManyを正しく呼び出しているかを確認する
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as deleteManyModule from '../../src/server/operations/deleteMany.js';
import { handleDeleteOne } from '../../src/server/operations/deleteOne.js';
import { errorSimulator } from '../helpers/error-simulators.js';
import { deleteManyResultBuilder } from '../helpers/response-builders.js';

// deleteManyをモック
vi.mock('../../src/server/operations/deleteMany.js', () => ({
  handleDeleteMany: vi.fn(),
}));

describe('deleteOne - 直接テスト', () => {
  const requestId = 'test-request-id';
  const resource = 'articles';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('idが指定された場合', () => {
    it('deleteMany([id])を呼び出して削除されたIDを返す', async () => {
      const testId = 'article-001';

      // deleteManyのモックレスポンス（Response Builderを使用）
      const mockDeleteManyResponse = deleteManyResultBuilder.success(1, [testId]);

      vi.mocked(deleteManyModule.handleDeleteMany).mockResolvedValue(mockDeleteManyResponse);

      // deleteOneを実行
      const result = await handleDeleteOne(
        resource,
        {
          id: testId,
        },
        requestId
      );

      // deleteManyが正しく呼び出されたことを確認
      expect(deleteManyModule.handleDeleteMany).toHaveBeenCalledWith(
        resource,
        {
          ids: [testId],
        },
        requestId
      );

      // 結果が { id } 形式であることを確認
      expect(result).toEqual({ id: testId });
    });

    it('削除が失敗した場合はErrorをスローする', async () => {
      const testId = 'article-001';

      // deleteManyのモックレスポンス（失敗、Response Builderを使用）
      const mockDeleteManyResponse = deleteManyResultBuilder.failure([testId], {
        0: errorSimulator.operationError(testId, 'NOT_FOUND', 'Record not found'),
      });

      vi.mocked(deleteManyModule.handleDeleteMany).mockResolvedValue(mockDeleteManyResponse);

      // deleteOneを実行してエラーを確認
      await expect(
        handleDeleteOne(
          resource,
          {
            id: testId,
          },
          requestId
        )
      ).rejects.toThrow('Failed to delete record');
    });
  });

  describe('filterが指定された場合', () => {
    it('deleteMany({ filter })を呼び出して削除されたIDを返す', async () => {
      const testFilter = { status: 'draft' };

      // deleteManyのモックレスポンス（Response Builderを使用）
      const mockDeleteManyResponse = deleteManyResultBuilder.success(1, ['article-002']);

      vi.mocked(deleteManyModule.handleDeleteMany).mockResolvedValue(mockDeleteManyResponse);

      // deleteOneを実行
      const result = await handleDeleteOne(
        resource,
        {
          filter: testFilter,
        },
        requestId
      );

      // deleteManyが正しく呼び出されたことを確認
      expect(deleteManyModule.handleDeleteMany).toHaveBeenCalledWith(
        resource,
        {
          filter: testFilter,
        },
        requestId
      );

      // 結果が { id } 形式であることを確認
      expect(result).toEqual({ id: 'article-002' });
    });
  });
});
