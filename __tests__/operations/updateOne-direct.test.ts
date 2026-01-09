/**
 * updateOne操作の直接テスト
 *
 * updateOneがupdateManyを正しく呼び出しているかを確認する
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as findOneModule from '../../src/server/operations/findOne.js';
import * as updateManyModule from '../../src/server/operations/updateMany.js';
import { handleUpdateOne } from '../../src/server/operations/updateOne.js';
import { errorSimulator } from '../helpers/error-simulators.js';
import { findOneResultBuilder, updateManyResultBuilder } from '../helpers/response-builders.js';

// updateManyとfindOneをモック
vi.mock('../../src/server/operations/updateMany.js', () => ({
  handleUpdateMany: vi.fn(),
}));

vi.mock('../../src/server/operations/findOne.js', () => ({
  handleFindOne: vi.fn(),
}));

describe('updateOne - 直接テスト', () => {
  const requestId = 'test-request-id';
  const resource = 'articles';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('idが指定された場合', () => {
    it('updateMany([id], data)を呼び出して更新されたレコードを返す', async () => {
      const testId = 'article-001';
      const testData = {
        title: '更新後のタイトル',
      };

      // updateManyのモックレスポンス（Response Builderを使用）
      const mockUpdateManyResponse = updateManyResultBuilder.success(1, [testId]);

      // findOneのモックレスポンス（Response Builderを使用）
      const mockFindOneResponse = findOneResultBuilder.success({
        id: testId,
        title: '更新後のタイトル',
        content: 'テスト内容',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      });

      vi.mocked(updateManyModule.handleUpdateMany).mockResolvedValue(mockUpdateManyResponse);
      vi.mocked(findOneModule.handleFindOne).mockResolvedValue(mockFindOneResponse);

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

      // findOneが正しく呼び出されたことを確認
      expect(findOneModule.handleFindOne).toHaveBeenCalledWith(resource, { id: testId }, requestId);

      // 結果が更新されたレコードオブジェクトであることを確認
      expect(result).toEqual(mockFindOneResponse);
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
    it('updateMany({ filter }, data)を呼び出して更新されたレコードを返す', async () => {
      const testFilter = { status: 'draft' };
      const testData = {
        status: 'published',
      };

      // updateManyのモックレスポンス（Response Builderを使用）
      const mockUpdateManyResponse = updateManyResultBuilder.success(1, ['article-002']);

      // findOneのモックレスポンス（Response Builderを使用）
      const mockFindOneResponse = findOneResultBuilder.success({
        id: 'article-002',
        title: 'フィルタ記事',
        content: 'フィルタ内容',
        status: 'published',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      });

      vi.mocked(updateManyModule.handleUpdateMany).mockResolvedValue(mockUpdateManyResponse);
      vi.mocked(findOneModule.handleFindOne).mockResolvedValue(mockFindOneResponse);

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

      // findOneが正しく呼び出されたことを確認
      expect(findOneModule.handleFindOne).toHaveBeenCalledWith(
        resource,
        { id: 'article-002' },
        requestId
      );

      // 結果が更新されたレコードオブジェクトであることを確認
      expect(result).toEqual(mockFindOneResponse);
    });
  });
});
