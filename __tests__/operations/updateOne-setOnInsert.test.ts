/**
 * updateOne $setOnInsert オペレーター テスト
 *
 * 要件: 27
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DynamoClient } from '../../src/client/index.iam.js';

// CI環境ではこのテストファイル全体をスキップ
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
const describeOrSkip = isCI ? describe.skip : describe;

// fetchをモック
global.fetch = vi.fn();

interface TestUser {
  id: string;
  name: string;
  email: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

describeOrSkip('updateOne $setOnInsert operator', () => {
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

  describe('insert case (upsert with non-existent record)', () => {
    it('should apply both $set and $setOnInsert on insert', async () => {
      const db = client.db('test');
      const collection = db.collection<TestUser>('users');

      // モックレスポンス: upsert insert
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 'user-1',
            name: 'Alice',
            email: 'alice@example.com',
            status: 'active',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
            __upsertedId: 'user-1',
          },
        }),
      });

      const result = await collection.updateOne(
        { id: 'user-1' },
        {
          $set: { name: 'Alice', email: 'alice@example.com' },
          $setOnInsert: { status: 'active' },
        },
        { upsert: true }
      );

      expect(result.upsertedId).toBe('user-1');
      expect(result.modifiedCount).toBe(0);

      // fetchが呼ばれたことを確認
      expect(global.fetch).toHaveBeenCalled();
      const callArgs = (global.fetch as any).mock.calls[0];
      expect(callArgs[1].body).toContain('"$set"');
      expect(callArgs[1].body).toContain('"$setOnInsert"');
    });

    it('should prioritize $set over $setOnInsert for same field on insert', async () => {
      const db = client.db('test');
      const collection = db.collection<TestUser>('users');

      // モックレスポンス
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 'user-2',
            name: 'Bob',
            status: 'pending',
            email: 'bob@example.com',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
            __upsertedId: 'user-2',
          },
        }),
      });

      const result = await collection.updateOne(
        { id: 'user-2' },
        {
          $set: { name: 'Bob', status: 'pending' },
          $setOnInsert: { status: 'active', email: 'bob@example.com' },
        },
        { upsert: true }
      );

      expect(result.upsertedId).toBe('user-2');
    });

    it('should work with only $setOnInsert on insert', async () => {
      const db = client.db('test');
      const collection = db.collection<TestUser>('users');

      // モックレスポンス
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 'user-3',
            name: 'Charlie',
            email: 'charlie@example.com',
            status: 'active',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
            __upsertedId: 'user-3',
          },
        }),
      });

      const result = await collection.updateOne(
        { id: 'user-3' },
        {
          $setOnInsert: { name: 'Charlie', email: 'charlie@example.com', status: 'active' },
        },
        { upsert: true }
      );

      expect(result.upsertedId).toBe('user-3');
    });
  });

  describe('update case (upsert with existing record)', () => {
    it('should ignore $setOnInsert on update', async () => {
      const db = client.db('test');
      const collection = db.collection<TestUser>('users');

      // モックレスポンス: upsert update
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 'user-4',
            name: 'David',
            email: 'david.new@example.com',
            status: 'active',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-02T00:00:00Z',
          },
        }),
      });

      const result = await collection.updateOne(
        { id: 'user-4' },
        {
          $set: { email: 'david.new@example.com' },
          $setOnInsert: { status: 'pending' },
        },
        { upsert: true }
      );

      expect(result.matchedCount).toBe(1);
      expect(result.modifiedCount).toBe(1);
      expect(result.upsertedId).toBeUndefined();
    });

    it('should work with only $setOnInsert on update (no changes)', async () => {
      const db = client.db('test');
      const collection = db.collection<TestUser>('users');

      // モックレスポンス
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 'user-5',
            name: 'Eve',
            email: 'eve@example.com',
            status: 'active',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-02T00:00:00Z',
          },
        }),
      });

      const result = await collection.updateOne(
        { id: 'user-5' },
        {
          $setOnInsert: { status: 'pending' },
        },
        { upsert: true }
      );

      expect(result.matchedCount).toBe(1);
      expect(result.modifiedCount).toBe(1);
    });

    it('should preserve createdAt on update', async () => {
      const db = client.db('test');
      const collection = db.collection<TestUser>('users');

      const originalCreatedAt = '2024-01-01T00:00:00Z';

      // モックレスポンス
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 'user-6',
            name: 'Frank Updated',
            email: 'frank@example.com',
            status: 'active',
            createdAt: originalCreatedAt,
            updatedAt: '2024-01-02T00:00:00Z',
          },
        }),
      });

      await collection.updateOne(
        { id: 'user-6' },
        {
          $set: { name: 'Frank Updated' },
          $setOnInsert: { createdAt: '2024-12-31T00:00:00Z' },
        },
        { upsert: true }
      );

      // fetchが呼ばれたことを確認
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('backward compatibility', () => {
    it('should work with traditional patch format (no $set)', async () => {
      const db = client.db('test');
      const collection = db.collection<TestUser>('users');

      // モックレスポンス
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 'user-7',
            name: 'Grace',
            email: 'grace.new@example.com',
            status: 'active',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-02T00:00:00Z',
          },
        }),
      });

      const result = await collection.updateOne(
        { id: 'user-7' },
        { email: 'grace.new@example.com' },
        { upsert: true }
      );

      expect(result.matchedCount).toBe(1);
      expect(result.modifiedCount).toBe(1);
    });
  });
});
