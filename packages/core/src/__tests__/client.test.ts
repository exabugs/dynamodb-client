import { beforeEach, describe, expect, it } from 'vitest';

import { DynamoClient } from '../client/DynamoClient.js';

describe('DynamoClient', () => {
  const MOCK_ENDPOINT = 'https://example.lambda-url.us-east-1.on.aws';

  describe('constructor', () => {
    it('エンドポイントを指定してクライアントを作成できる', () => {
      const client = new DynamoClient(MOCK_ENDPOINT);
      expect(client).toBeInstanceOf(DynamoClient);
    });

    it('認証オプションを指定してクライアントを作成できる', () => {
      const client = new DynamoClient(MOCK_ENDPOINT, {
        auth: {
          type: 'cognito',
          getToken: async () => 'mock-token',
        },
      });
      expect(client).toBeInstanceOf(DynamoClient);
    });
  });

  describe('connect', () => {
    it('認証なしで接続できる', async () => {
      const client = new DynamoClient(MOCK_ENDPOINT);
      await expect(client.connect()).resolves.toBeUndefined();
      expect(client.isConnected()).toBe(true);
    });

    it('Cognito認証で接続できる', async () => {
      const mockGetToken = async () => 'mock-cognito-token';
      const client = new DynamoClient(MOCK_ENDPOINT, {
        auth: {
          type: 'cognito',
          getToken: mockGetToken,
        },
      });

      await client.connect();
      expect(client.isConnected()).toBe(true);
    });

    it('IAM認証で接続できる', async () => {
      const client = new DynamoClient(MOCK_ENDPOINT, {
        auth: {
          type: 'iam',
          region: 'us-east-1',
        },
      });

      await client.connect();
      expect(client.isConnected()).toBe(true);
    });
  });

  describe('db', () => {
    let client: DynamoClient;

    beforeEach(async () => {
      client = new DynamoClient(MOCK_ENDPOINT);
      await client.connect();
    });

    it('データベースインスタンスを取得できる', () => {
      const db = client.db('test-db');
      expect(db).toBeDefined();
      expect(db.getDatabaseName()).toBe('test-db');
    });

    it('接続前にdb()を呼ぶとエラーになる', () => {
      const disconnectedClient = new DynamoClient(MOCK_ENDPOINT);
      expect(() => disconnectedClient.db('test-db')).toThrow(
        'Client is not connected. Please call await client.connect() before using the client.'
      );
    });
  });

  describe('close', () => {
    it('接続を切断できる', async () => {
      const client = new DynamoClient(MOCK_ENDPOINT);
      await client.connect();
      expect(client.isConnected()).toBe(true);

      await client.close();
      expect(client.isConnected()).toBe(false);
    });

    it('切断後にdb()を呼ぶとエラーになる', async () => {
      const client = new DynamoClient(MOCK_ENDPOINT);
      await client.connect();
      await client.close();

      expect(() => client.db('test-db')).toThrow(
        'Client is not connected. Please call await client.connect() before using the client.'
      );
    });
  });

  describe('isConnected', () => {
    it('初期状態では未接続', () => {
      const client = new DynamoClient(MOCK_ENDPOINT);
      expect(client.isConnected()).toBe(false);
    });

    it('connect後は接続状態', async () => {
      const client = new DynamoClient(MOCK_ENDPOINT);
      await client.connect();
      expect(client.isConnected()).toBe(true);
    });

    it('close後は未接続状態', async () => {
      const client = new DynamoClient(MOCK_ENDPOINT);
      await client.connect();
      await client.close();
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('入力バリデーション', () => {
    it('空のエンドポイントでエラーになる', () => {
      expect(() => new DynamoClient('')).toThrow('Endpoint cannot be empty');
    });

    it('空のデータベース名でエラーになる', async () => {
      const client = new DynamoClient(MOCK_ENDPOINT);
      await client.connect();
      expect(() => client.db('')).toThrow('Database name cannot be empty');
    });

    it('空白のみのデータベース名でエラーになる', async () => {
      const client = new DynamoClient(MOCK_ENDPOINT);
      await client.connect();
      expect(() => client.db('   ')).toThrow('Database name cannot be empty');
    });
  });

  describe('タイムアウト設定', () => {
    it('タイムアウトオプションを指定できる', () => {
      const client = new DynamoClient(MOCK_ENDPOINT, {
        timeout: 60000,
      });
      expect(client).toBeInstanceOf(DynamoClient);
    });
  });
});
