/**
 * findOne操作の直接テスト
 *
 * findOneがfindManyを正しく呼び出しているかを確認する
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as findManyModule from '../../src/server/operations/findMany.js';
import { handleFindOne } from '../../src/server/operations/findOne.js';
import { findManyResultBuilder } from '../helpers/response-builders.js';

// findManyをモック
vi.mock('../../src/server/operations/findMany.js', () => ({
  handleFindMany: vi.fn(),
}));

describe('findOne - 直接テスト', () => {
  const requestId = 'test-request-id';
  const resource = 'articles';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('idが指定された場合', () => {
    it('findMany([id])を呼び出して先頭の1件を取得する', async () => {
      // findManyのモックレスポンス（Response Builderを使用）
      const mockResponse = findManyResultBuilder.success([
        {
          id: 'article-001',
          title: 'テスト記事',
          content: 'テスト内容',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      ]);

      vi.mocked(findManyModule.handleFindMany).mockResolvedValue(mockResponse);

      // findOneを実行
      const result = await handleFindOne(
        resource,
        {
          id: 'article-001',
        },
        requestId
      );

      // findManyが正しく呼び出されたことを確認
      expect(findManyModule.handleFindMany).toHaveBeenCalledWith(
        resource,
        {
          ids: ['article-001'],
        },
        requestId
      );

      // 結果が単一レコードオブジェクトであることを確認
      expect(result).toEqual(mockResponse[0]);
    });

    it('レコードが存在しない場合はItemNotFoundErrorをスローする', async () => {
      // findManyのモックレスポンス（空配列、Response Builderを使用）
      const mockResponse = findManyResultBuilder.success([]);

      vi.mocked(findManyModule.handleFindMany).mockResolvedValue(mockResponse);

      // findOneを実行してエラーを確認
      await expect(
        handleFindOne(
          resource,
          {
            id: 'non-existent-id',
          },
          requestId
        )
      ).rejects.toThrow('Record not found');
    });
  });

  describe('filterが指定された場合', () => {
    it('findMany({ filter })を呼び出して先頭の1件を取得する', async () => {
      // findManyのモックレスポンス（Response Builderを使用）
      const mockResponse = findManyResultBuilder.success([
        {
          id: 'article-002',
          title: 'フィルタ記事',
          content: 'フィルタ内容',
          status: 'published',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      ]);

      vi.mocked(findManyModule.handleFindMany).mockResolvedValue(mockResponse);

      // findOneを実行
      const result = await handleFindOne(
        resource,
        {
          filter: { status: 'published' },
        },
        requestId
      );

      // findManyが正しく呼び出されたことを確認
      expect(findManyModule.handleFindMany).toHaveBeenCalledWith(
        resource,
        {
          filter: { status: 'published' },
        },
        requestId
      );

      // 結果が単一レコードオブジェクトであることを確認
      expect(result).toEqual(mockResponse[0]);
    });
  });
});
