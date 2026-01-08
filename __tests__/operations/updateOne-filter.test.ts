/**
 * updateOne filter オペレーター テスト
 *
 * filterを使用したupdateOne操作のテスト
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DynamoClient } from '../../src/client/index.iam.js';

// CI環境ではこのテストファイル全体をスキップ
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
const describeOrSkip = isCI ? describe.skip : describe;

// fetchをモック
global.fetch = vi.fn();

interface TestDevice {
  id: string;
  userId: string;
  token: string;
  type: 'ios' | 'android' | 'web';
  status: 'active' | 'inactive';
  failureCount: number;
  createdAt: string;
  updatedAt: string;
}

describeOrSkip('updateOne with filter', () => {
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

  describe('update case (existing record)', () => {
    it('should update existing record by filter', async () => {
      const db = client.db('test');
      const collection = db.collection<TestDevice>('devices');

      const testToken = 'test-token-123';

      // モックレスポンス: 既存レコードの更新
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 'device-1',
            userId: 'user-1',
            token: testToken,
            type: 'ios',
            status: 'active',
            failureCount: 0,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-02T00:00:00Z',
          },
        }),
      });

      const result = await collection.updateOne(
        { token: testToken },
        {
          $set: {
            userId: 'user-1',
            type: 'ios',
            status: 'active',
            failureCount: 0,
          },
        }
      );

      expect(result.matchedCount).toBe(1);
      expect(result.modifiedCount).toBe(1);
      expect(result.upsertedId).toBeUndefined();

      // fetchが呼ばれたことを確認
      expect(global.fetch).toHaveBeenCalled();
      const callArgs = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      expect(requestBody.params.filter).toEqual({ token: testToken });
    });

    it('should update with complex filter', async () => {
      const db = client.db('test');
      const collection = db.collection<TestDevice>('devices');

      // モックレスポンス
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 'device-2',
            userId: 'user-2',
            token: 'token-456',
            type: 'android',
            status: 'active',
            failureCount: 0,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-02T00:00:00Z',
          },
        }),
      });

      const result = await collection.updateOne(
        { userId: 'user-2', type: 'android' },
        {
          $set: {
            status: 'active',
            failureCount: 0,
          },
        }
      );

      expect(result.matchedCount).toBe(1);
      expect(result.modifiedCount).toBe(1);
    });
  });

  describe('upsert case (non-existent record)', () => {
    it('should create new record with filter and upsert', async () => {
      const db = client.db('test');
      const collection = db.collection<TestDevice>('devices');

      const testToken = 'new-token-789';

      // モックレスポンス: 新規作成
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 'device-3',
            userId: 'user-3',
            token: testToken,
            type: 'web',
            status: 'active',
            failureCount: 0,
            createdAt: '2024-01-03T00:00:00Z',
            updatedAt: '2024-01-03T00:00:00Z',
            __upsertedId: 'device-3',
          },
        }),
      });

      const result = await collection.updateOne(
        { token: testToken },
        {
          $set: {
            userId: 'user-3',
            type: 'web',
            status: 'active',
            failureCount: 0,
          },
          $setOnInsert: {
            token: testToken,
          },
        },
        { upsert: true }
      );

      expect(result.upsertedId).toBe('device-3');
      expect(result.matchedCount).toBe(0);
      expect(result.modifiedCount).toBe(0);

      // fetchが呼ばれたことを確認
      expect(global.fetch).toHaveBeenCalled();
      const callArgs = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      expect(requestBody.params.filter).toEqual({ token: testToken });
      expect(requestBody.params.options.upsert).toBe(true);
    });

    it('should apply both $set and $setOnInsert on upsert insert', async () => {
      const db = client.db('test');
      const collection = db.collection<TestDevice>('devices');

      const testToken = 'upsert-token-abc';

      // モックレスポンス
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 'device-4',
            userId: 'user-4',
            token: testToken,
            type: 'ios',
            status: 'active',
            failureCount: 0,
            createdAt: '2024-01-04T00:00:00Z',
            updatedAt: '2024-01-04T00:00:00Z',
            __upsertedId: 'device-4',
          },
        }),
      });

      const result = await collection.updateOne(
        { token: testToken },
        {
          $set: {
            userId: 'user-4',
            type: 'ios',
            status: 'active',
            failureCount: 0,
          },
          $setOnInsert: {
            token: testToken,
          },
        },
        { upsert: true }
      );

      expect(result.upsertedId).toBe('device-4');
    });
  });

  describe('device token uniqueness scenario', () => {
    it('should prevent duplicate device tokens with upsert', async () => {
      const db = client.db('test');
      const collection = db.collection<TestDevice>('devices');

      const sharedToken = 'shared-token-xyz';

      // 最初のユーザーがデバイスを登録
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 'device-5',
            userId: 'user-5',
            token: sharedToken,
            type: 'ios',
            status: 'active',
            failureCount: 0,
            createdAt: '2024-01-05T00:00:00Z',
            updatedAt: '2024-01-05T00:00:00Z',
            __upsertedId: 'device-5',
          },
        }),
      });

      const result1 = await collection.updateOne(
        { token: sharedToken },
        {
          $set: {
            userId: 'user-5',
            type: 'ios',
            status: 'active',
            failureCount: 0,
          },
          $setOnInsert: {
            token: sharedToken,
          },
        },
        { upsert: true }
      );

      expect(result1.upsertedId).toBe('device-5');

      // 2番目のユーザーが同じトークンで登録を試みる（既存レコードが更新される）
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 'device-5', // 同じID
            userId: 'user-6', // 異なるユーザー
            token: sharedToken,
            type: 'android',
            status: 'active',
            failureCount: 0,
            createdAt: '2024-01-05T00:00:00Z',
            updatedAt: '2024-01-06T00:00:00Z',
          },
        }),
      });

      const result2 = await collection.updateOne(
        { token: sharedToken },
        {
          $set: {
            userId: 'user-6',
            type: 'android',
            status: 'active',
            failureCount: 0,
          },
          $setOnInsert: {
            token: sharedToken,
          },
        },
        { upsert: true }
      );

      // 既存レコードが更新される（新規作成されない）
      expect(result2.upsertedId).toBeUndefined();
      expect(result2.matchedCount).toBe(1);
      expect(result2.modifiedCount).toBe(1);
    });
  });

  describe('error cases', () => {
    it('should throw error when record not found without upsert', async () => {
      const db = client.db('test');
      const collection = db.collection<TestDevice>('devices');

      // モックレスポンス: エラー
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          error: {
            code: 'ITEM_NOT_FOUND',
            message: 'Record not found with filter',
          },
        }),
      });

      await expect(
        collection.updateOne(
          { token: 'non-existent-token' },
          {
            $set: { status: 'active' },
          }
        )
      ).rejects.toThrow();
    });
  });
});
