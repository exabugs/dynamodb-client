/**
 * Webアプリケーション統合テスト
 *
 * react-adminのdataProviderを通じたエンドツーエンドのテストシナリオ:
 * - Cognito認証を使用したクライアント接続
 * - リスト取得（フィルター・ソート・ページネーション）
 * - レコード作成・更新・削除
 * - 複数レコードの一括操作
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DynamoClient } from '../client/index.cognito.js';
import type { Filter } from '../types.js';

// fetchをモック
global.fetch = vi.fn();

interface Article {
  id: string;
  title: string;
  content: string;
  status: 'draft' | 'published';
  priority: number;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

describe('Webアプリケーション統合テスト', () => {
  const MOCK_FUNCTION_URL = 'https://test.lambda-url.ap-northeast-1.on.aws';
  const MOCK_TOKEN = 'mock-cognito-token';

  let client: DynamoClient;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Cognito認証を使用したクライアントを作成
    client = new DynamoClient(MOCK_FUNCTION_URL, {
      auth: {
        getToken: async () => MOCK_TOKEN,
      },
    });

    await client.connect();
  });

  describe('記事管理のエンドツーエンドシナリオ', () => {
    it('記事の作成・取得・更新・削除のフルサイクル', async () => {
      const db = client.db('ainews');
      const articles = db.collection<Article>('articles');

      // 1. 記事を作成
      const newArticle: Partial<Article> = {
        title: 'テスト記事',
        content: 'これはテスト記事です',
        status: 'draft',
        priority: 5,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            insertedId: 'article-001',
          },
        }),
      });

      const createResult = await articles.insertOne(newArticle as Article);
      expect(createResult.acknowledged).toBe(true);
      expect(createResult.insertedId).toBe('article-001');

      // 2. 作成した記事を取得
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            documents: [
              {
                id: 'article-001',
                ...newArticle,
                createdAt: '2025-01-19T10:00:00.000Z',
                updatedAt: '2025-01-19T10:00:00.000Z',
              },
            ],
          },
        }),
      });

      const fetchedArticles = await articles
        .find({ id: 'article-001' } as Filter<Article>)
        .limit(1)
        .toArray();

      expect(fetchedArticles).toHaveLength(1);
      expect(fetchedArticles[0].id).toBe('article-001');
      expect(fetchedArticles[0].title).toBe('テスト記事');

      // 3. 記事を更新（下書きから公開へ）
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            matchedCount: 1,
            modifiedCount: 1,
          },
        }),
      });

      const updateResult = await articles.updateOne({ id: 'article-001' } as Filter<Article>, {
        set: {
          status: 'published',
          publishedAt: '2025-01-19T11:00:00.000Z',
        },
      });

      expect(updateResult.acknowledged).toBe(true);
      expect(updateResult.modifiedCount).toBe(1);

      // 4. 記事を削除
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            deletedCount: 1,
          },
        }),
      });

      const deleteResult = await articles.deleteOne({ id: 'article-001' } as Filter<Article>);
      expect(deleteResult.acknowledged).toBe(true);
      expect(deleteResult.deletedCount).toBe(1);
    });

    it('記事リストの取得（フィルター・ソート・ページネーション）', async () => {
      const db = client.db('ainews');
      const articles = db.collection<Article>('articles');

      const mockArticles: Article[] = [
        {
          id: 'article-001',
          title: '記事1',
          content: '内容1',
          status: 'published',
          priority: 10,
          publishedAt: '2025-01-19T10:00:00.000Z',
          createdAt: '2025-01-19T09:00:00.000Z',
          updatedAt: '2025-01-19T10:00:00.000Z',
        },
        {
          id: 'article-002',
          title: '記事2',
          content: '内容2',
          status: 'published',
          priority: 8,
          publishedAt: '2025-01-19T11:00:00.000Z',
          createdAt: '2025-01-19T09:30:00.000Z',
          updatedAt: '2025-01-19T11:00:00.000Z',
        },
        {
          id: 'article-003',
          title: '記事3',
          content: '内容3',
          status: 'published',
          priority: 6,
          publishedAt: '2025-01-19T12:00:00.000Z',
          createdAt: '2025-01-19T10:00:00.000Z',
          updatedAt: '2025-01-19T12:00:00.000Z',
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            documents: mockArticles,
          },
        }),
      });

      // 公開済み記事を優先度順（降順）で取得
      const results = await articles
        .find({ status: 'published' } as Filter<Article>)
        .sort({ priority: 'desc' })
        .limit(10)
        .toArray();

      expect(results).toHaveLength(3);
      expect(results[0].priority).toBe(10);
      expect(results[1].priority).toBe(8);
      expect(results[2].priority).toBe(6);

      // fetchが正しいパラメータで呼ばれたことを確認
      expect(global.fetch).toHaveBeenCalledWith(
        MOCK_FUNCTION_URL,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: `Bearer ${MOCK_TOKEN}`,
          }),
        })
      );
    });

    it('複数記事の一括操作', async () => {
      const db = client.db('ainews');
      const articles = db.collection<Article>('articles');

      // 1. 複数記事を一括作成
      const newArticles: Partial<Article>[] = [
        {
          title: '記事A',
          content: '内容A',
          status: 'draft',
          priority: 5,
        },
        {
          title: '記事B',
          content: '内容B',
          status: 'draft',
          priority: 3,
        },
        {
          title: '記事C',
          content: '内容C',
          status: 'draft',
          priority: 7,
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            count: 3,
            successIds: { 0: 'article-101', 1: 'article-102', 2: 'article-103' },
            failedIds: {},
            errors: {},
          },
        }),
      });

      const insertResult = await articles.insertMany(newArticles as Article[]);
      expect(insertResult.acknowledged).toBe(true);
      expect(insertResult.insertedCount).toBe(3);
      expect(Object.keys(insertResult.insertedIds)).toHaveLength(3);

      // 2. 複数記事を一括更新（下書きから公開へ）
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            count: 3,
            successIds: { 0: 'article-101', 1: 'article-102', 2: 'article-103' },
            failedIds: {},
            errors: {},
          },
        }),
      });

      const updateResult = await articles.updateMany({ status: 'draft' } as Filter<Article>, {
        set: {
          status: 'published',
          publishedAt: '2025-01-19T12:00:00.000Z',
        },
      });

      expect(updateResult.acknowledged).toBe(true);
      expect(updateResult.modifiedCount).toBe(3);

      // 3. 複数記事を一括削除
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            count: 3,
            successIds: { 0: 'article-A', 1: 'article-B', 2: 'article-C' },
            failedIds: {},
            errors: {},
          },
        }),
      });

      const deleteResult = await articles.deleteMany({
        id: { in: ['article-A', 'article-B', 'article-C'] },
      } as Filter<Article>);

      expect(deleteResult.acknowledged).toBe(true);
      expect(deleteResult.deletedCount).toBe(3);
    });

    it('複雑なフィルター条件での検索', async () => {
      const db = client.db('ainews');
      const articles = db.collection<Article>('articles');

      const mockArticles: Article[] = [
        {
          id: 'article-001',
          title: '高優先度記事',
          content: '重要な内容',
          status: 'published',
          priority: 10,
          publishedAt: '2025-01-19T10:00:00.000Z',
          createdAt: '2025-01-19T09:00:00.000Z',
          updatedAt: '2025-01-19T10:00:00.000Z',
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            documents: mockArticles,
          },
        }),
      });

      // 複雑なフィルター: 公開済み かつ 優先度が5以上
      const results = await articles
        .find({
          status: 'published',
          priority: { gte: 5 },
        } as Filter<Article>)
        .sort({ priority: 'desc' })
        .limit(10)
        .toArray();

      expect(results).toHaveLength(1);
      expect(results[0].priority).toBeGreaterThanOrEqual(5);
      expect(results[0].status).toBe('published');
    });

    it('エラーハンドリング: 認証エラー', async () => {
      const db = client.db('ainews');
      const articles = db.collection<Article>('articles');

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized',
        json: async () => ({
          message: 'Invalid authentication token',
        }),
      });

      await expect(
        articles.find({ status: 'published' } as Filter<Article>).toArray()
      ).rejects.toThrow('Request failed: Invalid authentication token');
    });

    it('エラーハンドリング: レコードが見つからない', async () => {
      const db = client.db('ainews');
      const articles = db.collection<Article>('articles');

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            documents: [],
          },
        }),
      });

      const results = await articles.find({ id: 'non-existent' } as Filter<Article>).toArray();

      expect(results).toHaveLength(0);
    });
  });

  describe('認証トークンの管理', () => {
    it('認証トークンがリクエストヘッダーに含まれる', async () => {
      const db = client.db('ainews');
      const articles = db.collection<Article>('articles');

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            documents: [],
          },
        }),
      });

      await articles.find({}).toArray();

      expect(global.fetch).toHaveBeenCalledWith(
        MOCK_FUNCTION_URL,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${MOCK_TOKEN}`,
          }),
        })
      );
    });

    it('認証トークンの取得に失敗した場合はエラー', async () => {
      const failingClient = new DynamoClient(MOCK_FUNCTION_URL, {
        auth: {
          getToken: async () => {
            throw new Error('Token retrieval failed');
          },
        },
      });

      await expect(failingClient.connect()).rejects.toThrow('Token retrieval failed');
    });
  });
});
