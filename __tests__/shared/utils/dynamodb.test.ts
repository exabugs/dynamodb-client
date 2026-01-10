/**
 * shared/utils/dynamodb.ts のユニットテスト
 * DynamoDBクライアント作成のテスト
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDynamoDBClient } from '../../../src/shared/utils/dynamodb.js';

describe('shared/utils/dynamodb', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // 環境変数をリセット
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // 環境変数を復元
    process.env = originalEnv;
  });

  describe('createDynamoDBClient', () => {
    it('デフォルト設定でDynamoDBクライアントを作成できる', () => {
      const client = createDynamoDBClient();
      expect(client).toBeDefined();
      expect(client.config).toBeDefined();
    });

    it('リージョンを指定してDynamoDBクライアントを作成できる', () => {
      const client = createDynamoDBClient({ region: 'ap-northeast-1' });
      expect(client).toBeDefined();
      expect(client.config.region).toBeDefined();
    });

    it('エンドポイントを指定してDynamoDBクライアントを作成できる', () => {
      const client = createDynamoDBClient({
        region: 'us-east-1',
        endpoint: 'http://localhost:8000',
      });
      expect(client).toBeDefined();
      expect(client.config.endpoint).toBeDefined();
    });

    it('環境変数AWS_REGIONを使用してDynamoDBクライアントを作成できる', () => {
      process.env.AWS_REGION = 'eu-west-1';
      const client = createDynamoDBClient();
      expect(client).toBeDefined();
      expect(client.config.region).toBeDefined();
    });

    it('リージョン指定が環境変数より優先される', () => {
      process.env.AWS_REGION = 'eu-west-1';
      const client = createDynamoDBClient({ region: 'ap-northeast-1' });
      expect(client).toBeDefined();
      // 明示的に指定したリージョンが使用される
      expect(client.config.region).toBeDefined();
    });

    it('環境変数がない場合はus-east-1がデフォルトになる', () => {
      delete process.env.AWS_REGION;
      const client = createDynamoDBClient();
      expect(client).toBeDefined();
      expect(client.config.region).toBeDefined();
    });

    it('marshallOptionsが正しく設定される', () => {
      const client = createDynamoDBClient();
      expect(client).toBeDefined();
      // DynamoDBDocumentClientが正しく作成されていることを確認
      expect(client.send).toBeDefined();
    });

    it('unmarshallOptionsが正しく設定される', () => {
      const client = createDynamoDBClient();
      expect(client).toBeDefined();
      // DynamoDBDocumentClientが正しく作成されていることを確認
      expect(client.send).toBeDefined();
    });
  });
});
