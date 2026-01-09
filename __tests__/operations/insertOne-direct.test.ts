/**
 * insertOne操作の直接テスト
 *
 * insertOneがinsertManyを正しく呼び出しているかを確認する
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as findOneModule from '../../src/server/operations/findOne.js';
import * as insertManyModule from '../../src/server/operations/insertMany.js';
import { handleInsertOne } from '../../src/server/operations/insertOne.js';

// insertManyとfindOneをモック
vi.mock('../../src/server/operations/insertMany.js', () => ({
  handleInsertMany: vi.fn(),
}));

vi.mock('../../src/server/operations/findOne.js', () => ({
  handleFindOne: vi.fn(),
}));

describe('insertOne - 直接テスト', () => {
  const requestId = 'test-request-id';
  const resource = 'articles';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('レコード作成が成功した場合', () => {
    it('insertMany([data])を呼び出して作成されたレコードを返す', async () => {
      const testData = {
        title: 'テスト記事',
        content: 'テスト内容',
      };

      // insertManyのモックレスポンス
      const mockInsertManyResponse = {
        count: 1,
        successIds: { 0: 'article-001' },
        failedIds: {},
        errors: {},
      };

      // findOneのモックレスポンス
      const mockFindOneResponse = {
        id: 'article-001',
        title: 'テスト記事',
        content: 'テスト内容',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };

      vi.mocked(insertManyModule.handleInsertMany).mockResolvedValue(mockInsertManyResponse);
      vi.mocked(findOneModule.handleFindOne).mockResolvedValue(mockFindOneResponse);

      // insertOneを実行
      const result = await handleInsertOne(
        resource,
        {
          data: testData,
        },
        requestId
      );

      // insertManyが正しく呼び出されたことを確認
      expect(insertManyModule.handleInsertMany).toHaveBeenCalledWith(
        resource,
        {
          data: [testData],
        },
        requestId
      );

      // findOneが正しく呼び出されたことを確認
      expect(findOneModule.handleFindOne).toHaveBeenCalledWith(
        resource,
        { id: 'article-001' },
        requestId
      );

      // 結果が作成されたレコードオブジェクトであることを確認
      expect(result).toEqual(mockFindOneResponse);
    });
  });

  describe('レコード作成が失敗した場合', () => {
    it('Errorをスローする', async () => {
      const testData = {
        title: 'テスト記事',
        content: 'テスト内容',
      };

      // insertManyのモックレスポンス（失敗）
      const mockInsertManyResponse = {
        count: 0,
        successIds: {},
        failedIds: { 0: 'article-001' },
        errors: {
          0: {
            id: 'article-001',
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
          },
        },
      };

      vi.mocked(insertManyModule.handleInsertMany).mockResolvedValue(mockInsertManyResponse);

      // insertOneを実行してエラーを確認
      await expect(
        handleInsertOne(
          resource,
          {
            data: testData,
          },
          requestId
        )
      ).rejects.toThrow('Failed to create record');
    });
  });
});
