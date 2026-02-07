/**
 * ページネーション（nextToken）のテスト
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Collection } from '../src/client/Collection.js';

// fetchをモック
global.fetch = vi.fn();

interface Article {
  id: string;
  title: string;
  status: string;
  category?: string;
  createdAt?: string;
}

describe('Pagination with nextToken', () => {
  const MOCK_ENDPOINT = 'https://example.lambda-url.us-east-1.on.aws';
  const MOCK_COLLECTION = 'articles';
  const MOCK_TOKEN = 'mock-token';
  const MOCK_AUTH_OPTIONS = {
    type: 'token' as const,
    token: MOCK_TOKEN,
  };

  let collection: Collection<Article>;

  // モック認証ハンドラー
  const mockGetAuthHeaders = vi.fn(async () => ({
    Authorization: `Bearer ${MOCK_TOKEN}`,
  }));

  beforeEach(() => {
    vi.clearAllMocks();
    collection = new Collection<Article>(
      MOCK_ENDPOINT,
      MOCK_COLLECTION,
      undefined, // authToken (deprecated)
      MOCK_AUTH_OPTIONS, // authOptions
      undefined, // clientOptions
      mockGetAuthHeaders // getAuthHeaders
    );
  });

  describe('find with pagination', () => {
    it('perPageで件数を制限できる', async () => {
      const mockResponse = {
        success: true,
        data: {
          items: [
            { id: '1', title: 'Article 1', status: 'published' },
            { id: '2', title: 'Article 2', status: 'published' },
          ],
          pageInfo: {
            hasNextPage: true,
            hasPreviousPage: false,
          },
          nextToken: 'mock-next-token',
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const cursor = collection.find({ status: 'published' }, { limit: 2 });
      const items = await cursor.toArray();

      expect(items).toHaveLength(2);
      expect(items[0].id).toBe('1');
      expect(items[1].id).toBe('2');

      // リクエストボディを確認
      const fetchCall = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.params.options.limit).toBe(2);
    });

    it('nextTokenで次ページを取得できる', async () => {
      const firstPageResponse = {
        success: true,
        data: {
          items: [
            { id: '1', title: 'Article 1', status: 'published' },
            { id: '2', title: 'Article 2', status: 'published' },
          ],
          pageInfo: {
            hasNextPage: true,
            hasPreviousPage: false,
          },
          nextToken: 'page-2-token',
        },
      };

      const secondPageResponse = {
        success: true,
        data: {
          items: [
            { id: '3', title: 'Article 3', status: 'published' },
            { id: '4', title: 'Article 4', status: 'published' },
          ],
          pageInfo: {
            hasNextPage: true,
            hasPreviousPage: true,
          },
          nextToken: 'page-3-token',
        },
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => firstPageResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => secondPageResponse,
        });

      // 最初のページ
      const firstCursor = collection.find({ status: 'published' }, { limit: 2 });
      const firstItems = await firstCursor.toArray();
      const firstPageInfo = await firstCursor.getPageInfo();

      expect(firstItems).toHaveLength(2);
      expect(firstItems[0].id).toBe('1');
      expect(firstPageInfo.nextToken).toBe('page-2-token');

      // 次ページ（nextTokenを使用）
      const secondCursor = collection.find(
        { status: 'published' },
        { limit: 2, nextToken: firstPageInfo.nextToken }
      );
      const secondItems = await secondCursor.toArray();

      expect(secondItems).toHaveLength(2);
      expect(secondItems[0].id).toBe('3');

      // nextTokenがリクエストに含まれていることを確認
      const secondFetchCall = (global.fetch as any).mock.calls[1];
      const secondRequestBody = JSON.parse(secondFetchCall[1].body);
      expect(secondRequestBody.params.options.nextToken).toBe('page-2-token');
    });

    it('最終ページではnextTokenが返されない', async () => {
      const lastPageResponse = {
        success: true,
        data: {
          items: [{ id: '5', title: 'Article 5', status: 'published' }],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: true,
          },
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => lastPageResponse,
      });

      const cursor = collection.find(
        { status: 'published' },
        { limit: 2, nextToken: 'last-page-token' }
      );
      const items = await cursor.toArray();
      const pageInfo = await cursor.getPageInfo();

      expect(items).toHaveLength(1);
      expect(items[0].id).toBe('5');
      expect(pageInfo.hasNextPage).toBe(false);
      expect(pageInfo.nextToken).toBeUndefined();

      // nextTokenがリクエストに含まれていることを確認
      const fetchCall = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.params.options.nextToken).toBe('last-page-token');
    });

    it('ソートとページネーションを組み合わせられる', async () => {
      const mockResponse = {
        success: true,
        data: {
          items: [
            { id: '4', title: 'Article 4', createdAt: '2024-01-04', status: 'published' },
            { id: '3', title: 'Article 3', createdAt: '2024-01-03', status: 'published' },
          ],
          pageInfo: {
            hasNextPage: true,
            hasPreviousPage: false,
          },
          nextToken: 'sorted-page-2',
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const cursor = collection.find({ status: 'published' }, { limit: 2 }).sort({ createdAt: -1 });
      const items = await cursor.toArray();

      expect(items).toHaveLength(2);
      expect(items[0].id).toBe('4');
      expect(items[1].id).toBe('3');

      // ソート条件がリクエストに含まれていることを確認
      const fetchCall = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.params.options.sort).toEqual({ createdAt: -1 });
      expect(requestBody.params.options.limit).toBe(2);
    });

    it('フィルターとページネーションを組み合わせられる', async () => {
      const mockResponse = {
        success: true,
        data: {
          items: [
            { id: '1', title: 'Article 1', status: 'published', category: 'tech' },
            { id: '2', title: 'Article 2', status: 'published', category: 'tech' },
          ],
          pageInfo: {
            hasNextPage: true,
            hasPreviousPage: false,
          },
          nextToken: 'filtered-page-2',
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const cursor = collection.find({ status: 'published', category: 'tech' }, { limit: 2 });
      const items = await cursor.toArray();

      expect(items).toHaveLength(2);
      expect(items.every((item) => item.status === 'published')).toBe(true);
      expect(items.every((item) => item.category === 'tech')).toBe(true);

      // フィルター条件がリクエストに含まれていることを確認
      const fetchCall = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.params.filter.status).toBe('published');
      expect(requestBody.params.filter.category).toBe('tech');
      expect(requestBody.params.options.limit).toBe(2);
    });
  });
});
