/**
 * 重複検出ロジックのテスト
 */
import { describe, expect, it } from 'vitest';

interface Article {
  id: string;
  name: string;
}

/**
 * 重複検出ロジック（Fetch Lambdaから抽出）
 */
function calculateDuplicateStats(
  totalArticles: number,
  existingCount: number,
  insertedCount: number,
  failedCount: number
) {
  const duplicateCount = existingCount;
  const newCount = insertedCount - duplicateCount - failedCount;

  // デバッグ用：負の場合は警告
  if (newCount < 0) {
    console.warn('Unexpected negative newCount', {
      totalArticles,
      existingCount,
      insertedCount,
      failedCount,
      calculated: newCount,
    });
    return {
      newCount: 0,
      duplicateCount,
      failedCount,
    };
  }

  return {
    newCount,
    duplicateCount,
    failedCount,
  };
}

describe('重複検出ロジック', () => {
  describe('calculateDuplicateStats', () => {
    it('すべて新規の場合', () => {
      // 17件取得、0件既存、17件挿入成功、0件失敗
      const result = calculateDuplicateStats(17, 0, 17, 0);

      expect(result).toEqual({
        newCount: 17,
        duplicateCount: 0,
        failedCount: 0,
      });
    });

    it('すべて重複の場合', () => {
      // 17件取得、17件既存、17件挿入成功（上書き）、0件失敗
      const result = calculateDuplicateStats(17, 17, 17, 0);

      expect(result).toEqual({
        newCount: 0,
        duplicateCount: 17,
        failedCount: 0,
      });
    });

    it('新規と重複が混在する場合', () => {
      // 20件取得、10件既存、20件挿入成功、0件失敗
      const result = calculateDuplicateStats(20, 10, 20, 0);

      expect(result).toEqual({
        newCount: 10,
        duplicateCount: 10,
        failedCount: 0,
      });
    });

    it('エラーがある場合', () => {
      // 20件取得、5件既存、18件挿入成功、2件失敗
      const result = calculateDuplicateStats(20, 5, 18, 2);

      expect(result).toEqual({
        newCount: 11, // 18 - 5 - 2 = 11
        duplicateCount: 5,
        failedCount: 2,
      });
    });

    it('すべて失敗の場合', () => {
      // 10件取得、0件既存、0件挿入成功、10件失敗
      const result = calculateDuplicateStats(10, 0, 0, 10);

      expect(result).toEqual({
        newCount: 0, // 負にならない
        duplicateCount: 0,
        failedCount: 10,
      });
    });

    it('異常ケース：負の値になる場合は0にする', () => {
      // 異常：既存17件だが、実際には15件しか挿入されなかった
      const result = calculateDuplicateStats(17, 17, 15, 0);

      expect(result).toEqual({
        newCount: 0, // -2 → 0
        duplicateCount: 17,
        failedCount: 0,
      });
    });
  });

  describe('findMany + insertMany統合シナリオ', () => {
    it('シナリオ1: 初回実行（すべて新規）', () => {
      const articles: Article[] = [
        { id: 'art-1', name: 'Article 1' },
        { id: 'art-2', name: 'Article 2' },
        { id: 'art-3', name: 'Article 3' },
      ];

      // findMany結果: 0件
      const existingRecords: Article[] = [];

      // insertMany結果: 3件成功
      const insertManyResult = {
        items: articles,
        failedIds: [],
        errors: [],
      };

      const stats = calculateDuplicateStats(
        articles.length,
        existingRecords.length,
        insertManyResult.items.length,
        insertManyResult.errors.length
      );

      expect(stats).toEqual({
        newCount: 3,
        duplicateCount: 0,
        failedCount: 0,
      });
    });

    it('シナリオ2: 2回目実行（すべて重複）', () => {
      const articles: Article[] = [
        { id: 'art-1', name: 'Article 1' },
        { id: 'art-2', name: 'Article 2' },
        { id: 'art-3', name: 'Article 3' },
      ];

      // findMany結果: 3件（すべて既存）
      const existingRecords: Article[] = articles;

      // insertMany結果: 3件成功（上書き）
      const insertManyResult = {
        items: articles,
        failedIds: [],
        errors: [],
      };

      const stats = calculateDuplicateStats(
        articles.length,
        existingRecords.length,
        insertManyResult.items.length,
        insertManyResult.errors.length
      );

      expect(stats).toEqual({
        newCount: 0,
        duplicateCount: 3,
        failedCount: 0,
      });
    });

    it('シナリオ3: 新規と重複が混在', () => {
      const articles: Article[] = [
        { id: 'art-1', name: 'Article 1' }, // 既存
        { id: 'art-2', name: 'Article 2' }, // 既存
        { id: 'art-3', name: 'Article 3' }, // 新規
        { id: 'art-4', name: 'Article 4' }, // 新規
        { id: 'art-5', name: 'Article 5' }, // 新規
      ];

      // findMany結果: 2件既存
      const existingRecords: Article[] = [articles[0], articles[1]];

      // insertMany結果: 5件成功
      const insertManyResult = {
        items: articles,
        failedIds: [],
        errors: [],
      };

      const stats = calculateDuplicateStats(
        articles.length,
        existingRecords.length,
        insertManyResult.items.length,
        insertManyResult.errors.length
      );

      expect(stats).toEqual({
        newCount: 3,
        duplicateCount: 2,
        failedCount: 0,
      });
    });
  });
});
