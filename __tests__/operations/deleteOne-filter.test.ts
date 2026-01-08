/**
 * deleteOne filter オペレーター テスト
 *
 * filterを使用したdeleteOne操作のテスト
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
}

describeOrSkip('deleteOne with filter', () => {
  const MOCK_FUNCTION_URL = 'https://test.lambda-url.ap-northeast-1.on.aws';
  const MOCK_REGION = 'ap-northeast-1';

  let client: DynamoClient;

  beforeEach(async () => {
    vi.clearAllMocks();

    client = new DynamoClient(MOCK_FUNCTION_URL, {
      auth: {
        region: MOCK_REGION,
      },
    });

    await client.connect();
  });

  describe('delete by filter', () => {
    it('should delete record by filter', async () => {
      const db = client.db('test');
      const collection = db.collection<TestDevice>('devices');

      const testToken = 'test-token-123';

      // モックレスポンス
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            deletedCount: 1,
          },
        }),
      });

      const result = await collection.deleteOne({ token: testToken });

      expect(result.deletedCount).toBe(1);

      // fetchが呼ばれたことを確認
      expect(global.fetch).toHaveBeenCalled();
      const callArgs = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      expect(requestBody.params.filter).toEqual({ token: testToken });
    });

    it('should delete with complex filter', async () => {
      const db = client.db('test');
      const collection = db.collection<TestDevice>('devices');

      // モックレスポンス
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            deletedCount: 1,
          },
        }),
      });

      const result = await collection.deleteOne({
        userId: 'user-1',
        status: 'inactive',
      });

      expect(result.deletedCount).toBe(1);
    });
  });

  describe('error cases', () => {
    it('should throw error when record not found', async () => {
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

      await expect(collection.deleteOne({ token: 'non-existent-token' })).rejects.toThrow();
    });
  });
});
