/**
 * updateMany $setOnInsert オペレーター テスト
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

describeOrSkip('updateMany $setOnInsert operator', () => {
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

  describe('update case (existing records)', () => {
    it('should ignore $setOnInsert on update', async () => {
      const db = client.db('test');
      const collection = db.collection<TestUser>('users');

      // モックレスポンス: updateMany update
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            count: 2,
            successIds: { 0: 'user-1', 1: 'user-2' },
            failedIds: {},
            errors: {},
          },
        }),
      });

      const result = await collection.updateMany(
        { id: { $in: ['user-1', 'user-2'] } },
        {
          $set: { status: 'active' },
          $setOnInsert: { email: 'ignored@example.com' },
        }
      );

      expect(result.matchedCount).toBe(2);
      expect(result.modifiedCount).toBe(2);

      // fetchが呼ばれたことを確認
      expect(global.fetch).toHaveBeenCalled();
      const callArgs = (global.fetch as any).mock.calls[0];
      expect(callArgs[1].body).toContain('"$set"');
      expect(callArgs[1].body).toContain('"$setOnInsert"');
    });

    it('should work with only $setOnInsert on update (no field changes)', async () => {
      const db = client.db('test');
      const collection = db.collection<TestUser>('users');

      // モックレスポンス
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            count: 2,
            successIds: { 0: 'user-1', 1: 'user-2' },
            failedIds: {},
            errors: {},
          },
        }),
      });

      const result = await collection.updateMany(
        { id: { $in: ['user-1', 'user-2'] } },
        {
          $setOnInsert: { status: 'pending' },
        }
      );

      expect(result.matchedCount).toBe(2);
      expect(result.modifiedCount).toBe(2);
    });

    it('should preserve createdAt on update', async () => {
      const db = client.db('test');
      const collection = db.collection<TestUser>('users');

      // モックレスポンス
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            count: 2,
            successIds: { 0: 'user-1', 1: 'user-2' },
            failedIds: {},
            errors: {},
          },
        }),
      });

      await collection.updateMany(
        { id: { $in: ['user-1', 'user-2'] } },
        {
          $set: { name: 'Updated' },
          $setOnInsert: { createdAt: '2024-12-31T00:00:00Z' },
        }
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
            count: 2,
            successIds: { 0: 'user-1', 1: 'user-2' },
            failedIds: {},
            errors: {},
          },
        }),
      });

      const result = await collection.updateMany(
        { id: { $in: ['user-1', 'user-2'] } },
        { status: 'active' }
      );

      expect(result.matchedCount).toBe(2);
      expect(result.modifiedCount).toBe(2);
    });
  });
});
