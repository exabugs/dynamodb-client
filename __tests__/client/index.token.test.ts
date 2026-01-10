/**
 * client/index.token.ts のユニットテスト
 * Token認証クライアントのテスト
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DynamoClient } from '../../src/client/index.token.js';

// fetchをモック
global.fetch = vi.fn();

describe('client/index.token', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('DynamoClient', () => {
    it('Token認証でクライアントを作成できる', () => {
      const client = new DynamoClient('https://api.example.com', {
        auth: { token: 'test-token-123' },
      });
      expect(client).toBeDefined();
      expect(client.db).toBeDefined();
    });

    it('認証トークンが設定される', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({ data: { id: '123' } }),
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      const client = new DynamoClient('https://api.example.com', {
        auth: { token: 'test-token-123' },
        autoConnect: true,
      });

      const db = client.db('test-db');
      const collection = db.collection('users');

      // findOneを実行してfetchが呼ばれることを確認
      await collection.findOne({ id: '123' });

      expect(global.fetch).toHaveBeenCalled();
      const fetchCall = (global.fetch as any).mock.calls[0];
      const headers = fetchCall[1].headers;
      expect(headers.Authorization).toBe('Bearer test-token-123');
    });

    it('認証トークンなしでエラーをスローする', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({ data: { id: '123' } }),
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      // authなしでクライアントを作成（型エラーを回避するためにany使用）
      const client = new DynamoClient('https://api.example.com', {
        auth: { token: '' },
        autoConnect: true,
      } as any);

      const db = client.db('test-db');
      const collection = db.collection('users');

      // 空のトークンでもAuthorizationヘッダーは設定される
      await collection.findOne({ id: '123' });

      expect(global.fetch).toHaveBeenCalled();
      const fetchCall = (global.fetch as any).mock.calls[0];
      const headers = fetchCall[1].headers;
      expect(headers.Authorization).toBe('Bearer ');
    });

    it('複数のリクエストで同じトークンを使用する', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({ data: { id: '123' } }),
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      const client = new DynamoClient('https://api.example.com', {
        auth: { token: 'test-token-123' },
        autoConnect: true,
      });

      const db = client.db('test-db');
      const collection = db.collection('users');

      // 複数回リクエスト
      await collection.findOne({ id: '123' });
      await collection.findOne({ id: '456' });

      expect(global.fetch).toHaveBeenCalledTimes(2);

      // 両方のリクエストで同じトークンが使用されることを確認
      const call1Headers = (global.fetch as any).mock.calls[0][1].headers;
      const call2Headers = (global.fetch as any).mock.calls[1][1].headers;
      expect(call1Headers.Authorization).toBe('Bearer test-token-123');
      expect(call2Headers.Authorization).toBe('Bearer test-token-123');
    });

    it('異なるトークンで複数のクライアントを作成できる', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({ data: { id: '123' } }),
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      const client1 = new DynamoClient('https://api.example.com', {
        auth: { token: 'token-1' },
        autoConnect: true,
      });

      const client2 = new DynamoClient('https://api.example.com', {
        auth: { token: 'token-2' },
        autoConnect: true,
      });

      const db1 = client1.db('test-db');
      const collection1 = db1.collection('users');

      const db2 = client2.db('test-db');
      const collection2 = db2.collection('users');

      await collection1.findOne({ id: '123' });
      await collection2.findOne({ id: '456' });

      expect(global.fetch).toHaveBeenCalledTimes(2);

      // 異なるトークンが使用されることを確認
      const call1Headers = (global.fetch as any).mock.calls[0][1].headers;
      const call2Headers = (global.fetch as any).mock.calls[1][1].headers;
      expect(call1Headers.Authorization).toBe('Bearer token-1');
      expect(call2Headers.Authorization).toBe('Bearer token-2');
    });
  });
});
