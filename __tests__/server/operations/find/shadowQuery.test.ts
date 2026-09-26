/**
 * シャドウレコードクエリのテスト
 *
 * 回帰対象: sort.field以外のフィールドへのフィルタ、または$containsのように
 * KeyConditionExpressionで絞り込めない演算子が残っている場合に、
 * Limit付き単発クエリでは「取得した1ページの中にだけ」フィルタが適用され、
 * ページの外にある本来マッチすべきレコードが漏れてしまう不具合を検証する。
 * （例: Admin UIの開催地名オートコンプリート検索で `name:$contains` を使うと、
 * 　　  先頭のLimit件に含まれない開催地がヒットしなかった）
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { executeShadowQuery } from '../../../../src/server/operations/find/shadowQuery.js';
import type { NormalizedFindParams } from '../../../../src/server/operations/find/types.js';

// DynamoDB Clientのモック
vi.mock('@aws-sdk/lib-dynamodb', () => ({
  QueryCommand: vi.fn(),
  BatchGetCommand: vi.fn(),
  DynamoDBDocumentClient: {
    from: vi.fn(),
  },
}));

// ユーティリティのモック
vi.mock('../../../../src/server/utils/dynamodb.js', () => ({
  getDBClient: vi.fn(() => ({
    send: vi.fn(),
  })),
  getTableName: vi.fn(() => 'test-table'),
  executeDynamoDBOperation: vi.fn(async (fn) => await fn()),
  extractCleanRecord: vi.fn((item) => item.data),
}));

vi.mock('../../../../src/server/utils/pagination.js', () => ({
  decodeNextToken: vi.fn((token: string) => {
    const [PK, SK] = token.split(':::');
    return { PK, SK };
  }),
  encodeNextToken: vi.fn((pk: string, sk: string) => `${pk}:::${sk}`),
  decodeOffsetToken: vi.fn((token: string) => parseInt(token.replace('offset:', ''), 10)),
  encodeOffsetToken: vi.fn((offset: number) => `offset:${offset}`),
}));

// findOptimizableFilter / matchesAllFilters は実装をそのまま使う（バグの実質的な検証対象のため）

describe('executeShadowQuery', () => {
  const mockDbClient = {
    send: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const { getDBClient } = await import('../../../../src/server/utils/dynamodb.js');
    vi.mocked(getDBClient).mockReturnValue(mockDbClient as any);
  });

  describe('フルスキャンフォールバック（$contains等の残存フィルタがある場合）', () => {
    it('sort.field自体への$containsフィルタは、複数ページをまたいで全件から正しくヒットする', async () => {
      // シャドウインデックス 1ページ目: マッチしないレコードのみ + 次ページあり
      mockDbClient.send
        .mockResolvedValueOnce({
          Items: [
            { PK: 'venues', SK: 'name#デモ会場#id#venue-1' },
            { PK: 'venues', SK: 'name#別会場#id#venue-2' },
          ],
          LastEvaluatedKey: { PK: 'venues', SK: 'name#別会場#id#venue-2' },
        })
        // シャドウインデックス 2ページ目: マッチするレコードを含む + 次ページなし
        .mockResolvedValueOnce({
          Items: [{ PK: 'venues', SK: 'name#保木公園#id#venue-3' }],
        })
        // 本体レコードの一括取得（BatchGetCommand）
        .mockResolvedValueOnce({
          Responses: {
            'test-table': [
              { PK: 'venues', SK: 'id#venue-1', data: { id: 'venue-1', name: 'デモ会場' } },
              { PK: 'venues', SK: 'id#venue-2', data: { id: 'venue-2', name: '別会場' } },
              { PK: 'venues', SK: 'id#venue-3', data: { id: 'venue-3', name: '保木公園' } },
            ],
          },
        });

      const params: NormalizedFindParams = {
        sort: { field: 'name', order: 'ASC' },
        // perPageが小さくても、$containsが残存フィルタである限り
        // シャドウクエリのLimitには使われない（常に1000でループ取得する）ことを担保する
        pagination: { perPage: 1, nextToken: undefined },
        parsedFilters: [{ parsed: { field: 'name', operator: '$contains', type: 'string' }, value: '保木' }],
      };

      const result = await executeShadowQuery('venues', params, 'req-1');

      // シャドウ2ページ + BatchGet1回 = 3回。Limit付き単発クエリなら1回で終わってしまう
      expect(mockDbClient.send).toHaveBeenCalledTimes(3);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('保木公園');
    });

    it('sort.field以外のフィールドへの$eqフィルタも、cardinality未指定でfilter-first対象外の場合はフルスキャンで正しく絞り込む', async () => {
      mockDbClient.send
        .mockResolvedValueOnce({
          Items: [
            { PK: 'venues', SK: 'name#会場A#id#venue-1' },
            { PK: 'venues', SK: 'name#会場B#id#venue-2' },
          ],
        })
        .mockResolvedValueOnce({
          Responses: {
            'test-table': [
              {
                PK: 'venues',
                SK: 'id#venue-1',
                data: { id: 'venue-1', name: '会場A', prefecture: '13' },
              },
              {
                PK: 'venues',
                SK: 'id#venue-2',
                data: { id: 'venue-2', name: '会場B', prefecture: '14' },
              },
            ],
          },
        });

      const params: NormalizedFindParams = {
        sort: { field: 'name', order: 'ASC' },
        pagination: { perPage: 10, nextToken: undefined },
        // schemaを渡さない = cardinalityヒントなし = filter-first無効
        parsedFilters: [{ parsed: { field: 'prefecture', operator: '$eq', type: 'string' }, value: '13' }],
      };

      const result = await executeShadowQuery('venues', params, 'req-1');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('venue-1');
    });
  });

  describe('通常戦略（残存フィルタなし）は従来どおりLimit付き単発クエリのまま', () => {
    it('フィルタなしの場合はシャドウクエリを1回だけ実行する', async () => {
      mockDbClient.send.mockResolvedValueOnce({
        Items: [{ PK: 'venues', SK: 'name#会場A#id#venue-1' }],
      });
      mockDbClient.send.mockResolvedValueOnce({
        Responses: {
          'test-table': [{ PK: 'venues', SK: 'id#venue-1', data: { id: 'venue-1', name: '会場A' } }],
        },
      });

      const params: NormalizedFindParams = {
        sort: { field: 'name', order: 'ASC' },
        pagination: { perPage: 10, nextToken: undefined },
        parsedFilters: [],
      };

      const result = await executeShadowQuery('venues', params, 'req-1');

      // シャドウクエリ1回 + BatchGet1回 = 2回（フルスキャンのループには入らない）
      expect(mockDbClient.send).toHaveBeenCalledTimes(2);
      expect(result.items).toHaveLength(1);
    });
  });
});
