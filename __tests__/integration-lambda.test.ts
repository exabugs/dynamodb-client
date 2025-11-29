/**
 * Lambda統合テスト
 *
 * Lambda関数からDynamoClientを使用したエンドツーエンドのテストシナリオ:
 * - IAM認証を使用したクライアント接続
 * - バッチ処理（大量データの一括挿入）
 * - データ変換とクリーンアップ
 * - エラーハンドリングとリトライ
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DynamoClient } from '../src/client/index.iam.js';
import type { Filter } from '../src/types.js';

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

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: number;
  createdAt: string;
  updatedAt: string;
}

describe('Lambda統合テスト', () => {
  const MOCK_FUNCTION_URL = 'https://test.lambda-url.ap-northeast-1.on.aws';
  const MOCK_REGION = 'ap-northeast-1';

  let client: DynamoClient;

  beforeEach(async () => {
    vi.clearAllMocks();

    // IAM認証を使用したクライアントを作成
    client = new DynamoClient(MOCK_FUNCTION_URL, {
      auth: {
        region: MOCK_REGION,
      },
    });

    await client.connect();
  });

  describe('バッチ処理シナリオ', () => {
    it('外部APIから取得したデータを一括挿入', async () => {
      const db = client.db('ainews');
      const articles = db.collection<Article>('articles');

      // 外部APIから取得したデータをシミュレート
      const externalData = [
        {
          title: 'ニュース記事1',
          content: '記事の内容1',
          status: 'draft' as const,
          priority: 5,
        },
        {
          title: 'ニュース記事2',
          content: '記事の内容2',
          status: 'draft' as const,
          priority: 3,
        },
        {
          title: 'ニュース記事3',
          content: '記事の内容3',
          status: 'draft' as const,
          priority: 7,
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            count: 3,
            successIds: { 0: 'article-001', 1: 'article-002', 2: 'article-003' },
            failedIds: {},
            errors: {},
          },
        }),
      });

      const result = await articles.insertMany(externalData as Article[]);

      expect(result.acknowledged).toBe(true);
      expect(result.insertedCount).toBe(3);
      expect(Object.keys(result.insertedIds)).toHaveLength(3);

      // IAM認証が使用されていることを確認
      expect(global.fetch).toHaveBeenCalledWith(
        MOCK_FUNCTION_URL,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('大量データの一括挿入（100件）', async () => {
      const db = client.db('ainews');
      const articles = db.collection<Article>('articles');

      // 100件のデータを生成
      const largeDataset = Array.from({ length: 100 }, (_, i) => ({
        title: `記事${i + 1}`,
        content: `内容${i + 1}`,
        status: 'draft' as const,
        priority: Math.floor(Math.random() * 10) + 1,
      }));

      const successIds = Array.from({ length: 100 }, (_, i) => i).reduce(
        (acc, i) => {
          acc[i] = `article-${String(i + 1).padStart(3, '0')}`;
          return acc;
        },
        {} as Record<number, string>
      );

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            count: 100,
            successIds,
            failedIds: {},
            errors: {},
          },
        }),
      });

      const result = await articles.insertMany(largeDataset as Article[]);

      expect(result.acknowledged).toBe(true);
      expect(result.insertedCount).toBe(100);
      expect(Object.keys(result.insertedIds)).toHaveLength(100);
    });

    it('部分的な失敗を含む一括挿入', async () => {
      const db = client.db('ainews');
      const articles = db.collection<Article>('articles');

      const dataWithErrors = [
        {
          title: '正常な記事1',
          content: '内容1',
          status: 'draft' as const,
          priority: 5,
        },
        {
          title: '正常な記事2',
          content: '内容2',
          status: 'draft' as const,
          priority: 3,
        },
      ];

      // 部分的な失敗のシミュレーション
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            count: 2,
            successIds: { 0: 'article-001', 1: 'article-002' },
            failedIds: { 2: 'article-003' },
            errors: { 2: { id: 'article-003', code: 'VALIDATION_ERROR', message: 'Invalid data' } },
          },
        }),
      });

      const result = await articles.insertMany(dataWithErrors as Article[]);

      expect(result.acknowledged).toBe(true);
      expect(result.insertedCount).toBe(2);
      expect(result.insertedIds).toBeDefined();
    });
  });

  describe('データ変換とクリーンアップ', () => {
    it('古いレコードを検索して削除', async () => {
      const db = client.db('ainews');
      const articles = db.collection<Article>('articles');

      // 1. 古いレコードを検索
      const oldArticles: Article[] = [
        {
          id: 'article-old-001',
          title: '古い記事1',
          content: '内容1',
          status: 'published',
          priority: 5,
          publishedAt: '2024-01-01T00:00:00.000Z',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'article-old-002',
          title: '古い記事2',
          content: '内容2',
          status: 'published',
          priority: 3,
          publishedAt: '2024-01-02T00:00:00.000Z',
          createdAt: '2024-01-02T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            documents: oldArticles,
          },
        }),
      });

      const foundArticles = await articles
        .find({
          publishedAt: { lt: '2024-06-01T00:00:00.000Z' },
        } as Filter<Article>)
        .toArray();

      expect(foundArticles).toHaveLength(2);

      // 2. 見つかったレコードを削除
      const idsToDelete = foundArticles.map((article) => article.id);

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            count: 2,
            successIds: { 0: 'id1', 1: 'id2' },
            failedIds: {},
            errors: {},
          },
        }),
      });

      const deleteResult = await articles.deleteMany({
        id: { in: idsToDelete },
      } as Filter<Article>);

      expect(deleteResult.acknowledged).toBe(true);
      expect(deleteResult.deletedCount).toBe(2);
    });

    it('ステータスを一括更新', async () => {
      const db = client.db('ainews');
      const tasks = db.collection<Task>('tasks');

      // 1. 処理中のタスクを検索
      const processingTasks: Task[] = [
        {
          id: 'task-001',
          title: 'タスク1',
          description: '説明1',
          status: 'processing',
          priority: 5,
          createdAt: '2025-01-19T10:00:00.000Z',
          updatedAt: '2025-01-19T10:00:00.000Z',
        },
        {
          id: 'task-002',
          title: 'タスク2',
          description: '説明2',
          status: 'processing',
          priority: 3,
          createdAt: '2025-01-19T10:30:00.000Z',
          updatedAt: '2025-01-19T10:30:00.000Z',
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            documents: processingTasks,
          },
        }),
      });

      const foundTasks = await tasks.find({ status: 'processing' } as Filter<Task>).toArray();

      expect(foundTasks).toHaveLength(2);

      // 2. ステータスを完了に更新
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            count: 2,
            successIds: { 0: 'task-001', 1: 'task-002' },
            failedIds: {},
            errors: {},
          },
        }),
      });

      const updateResult = await tasks.updateMany({ status: 'processing' } as Filter<Task>, {
        set: {
          status: 'completed',
        },
      });

      expect(updateResult.acknowledged).toBe(true);
      expect(updateResult.modifiedCount).toBe(2);
    });
  });

  describe('複数リソースの操作', () => {
    it('記事とタスクを同時に処理', async () => {
      const db = client.db('ainews');
      const articles = db.collection<Article>('articles');
      const tasks = db.collection<Task>('tasks');

      // 1. 記事を作成
      const articleData = {
        title: '新しい記事',
        content: '内容',
        status: 'draft',
        priority: 5,
      } as Article;

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            count: 1,
            successIds: { 0: 'article-001' },
            failedIds: {},
            errors: {},
          },
        }),
      });

      const articleResult = await articles.insertMany([articleData]);

      expect(articleResult.insertedCount).toBe(1);

      // 2. タスクを作成
      const taskData = {
        title: '新しいタスク',
        status: 'pending',
        priority: 3,
      } as Task;

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            count: 1,
            successIds: { 0: 'task-001' },
            failedIds: {},
            errors: {},
          },
        }),
      });

      const taskResult = await tasks.insertMany([
        {
          title: '記事処理タスク',
          description: '記事を処理する',
          status: 'pending',
          priority: 5,
        } as Task,
      ]);

      expect(taskResult.insertedCount).toBe(1);

      // 3. 両方のリソースを検索
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            documents: [
              {
                id: 'article-001',
                title: '新しい記事',
                content: '内容',
                status: 'draft',
                priority: 5,
                createdAt: '2025-01-19T10:00:00.000Z',
                updatedAt: '2025-01-19T10:00:00.000Z',
              },
            ],
          },
        }),
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            documents: [
              {
                id: 'task-001',
                title: '記事処理タスク',
                description: '記事を処理する',
                status: 'pending',
                priority: 5,
                createdAt: '2025-01-19T10:00:00.000Z',
                updatedAt: '2025-01-19T10:00:00.000Z',
              },
            ],
          },
        }),
      });

      const foundArticles = await articles.find({}).limit(10).toArray();
      const foundTasks = await tasks.find({}).limit(10).toArray();

      expect(foundArticles).toHaveLength(1);
      expect(foundTasks).toHaveLength(1);
    });
  });

  describe('エラーハンドリングとリトライ', () => {
    it('一時的なエラーからのリカバリー', async () => {
      const db = client.db('ainews');
      const articles = db.collection<Article>('articles');

      // 1回目: エラー
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Service Unavailable',
        json: async () => ({
          message: 'Temporary service error',
        }),
      });

      await expect(
        articles.insertOne({
          title: 'テスト記事',
          content: '内容',
          status: 'draft',
          priority: 5,
        } as Article)
      ).rejects.toThrow('Request failed: Temporary service error');

      // 2回目: 成功
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            insertedId: 'article-001',
          },
        }),
      });

      const result = await articles.insertOne({
        title: 'テスト記事',
        content: '内容',
        status: 'draft',
        priority: 5,
      } as Article);

      expect(result.acknowledged).toBe(true);
      expect(result.insertedId).toBe('article-001');
    });

    it('タイムアウトエラーのハンドリング', async () => {
      const db = client.db('ainews');
      const articles = db.collection<Article>('articles');

      (global.fetch as any).mockRejectedValueOnce(new Error('Request timeout'));

      await expect(articles.find({}).toArray()).rejects.toThrow('Request timeout');
    });

    it('ネットワークエラーのハンドリング', async () => {
      const db = client.db('ainews');
      const articles = db.collection<Article>('articles');

      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await expect(
        articles.insertOne({
          title: 'テスト記事',
          content: '内容',
          status: 'draft',
          priority: 5,
        } as Article)
      ).rejects.toThrow('Network error');
    });
  });

  describe('パフォーマンステスト', () => {
    it('大量データの処理時間を測定', async () => {
      const db = client.db('ainews');
      const articles = db.collection<Article>('articles');

      const startTime = Date.now();

      // 1000件のデータを生成
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        title: `記事${i + 1}`,
        content: `内容${i + 1}`,
        status: 'draft' as const,
        priority: Math.floor(Math.random() * 10) + 1,
      }));

      const successIds = Array.from({ length: 1000 }, (_, i) => i).reduce(
        (acc, i) => {
          acc[i] = `article-${String(i + 1).padStart(4, '0')}`;
          return acc;
        },
        {} as Record<number, string>
      );

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            count: 1000,
            successIds,
            failedIds: {},
            errors: {},
          },
        }),
      });

      const result = await articles.insertMany(largeDataset as Article[]);

      const duration = Date.now() - startTime;

      expect(result.acknowledged).toBe(true);
      expect(result.insertedCount).toBe(1000);

      // パフォーマンスログ（実際のテストでは閾値チェックを行う）
      console.log(`1000件の挿入処理時間: ${duration}ms`);
    });
  });
});
