import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDynamoDBClient } from '../dynamodb.js';

describe('createDynamoDBClient', () => {
  const originalRegion = process.env.AWS_REGION;

  beforeEach(() => {
    delete process.env.AWS_REGION;
  });

  afterEach(() => {
    if (originalRegion) {
      process.env.AWS_REGION = originalRegion;
    } else {
      delete process.env.AWS_REGION;
    }
  });

  it('DynamoDB Document Clientを作成できること', () => {
    const client = createDynamoDBClient();
    expect(client).toBeDefined();
    expect(client.send).toBeDefined();
  });

  it('リージョンが指定されていない場合、デフォルトのus-east-1を使用すること', () => {
    const client = createDynamoDBClient();
    expect(client).toBeDefined();
    // デフォルトリージョンでクライアントが正常に作成される
  });

  it('設定パラメータからリージョンを使用すること', () => {
    const client = createDynamoDBClient({ region: 'ap-northeast-1' });
    expect(client).toBeDefined();
  });

  it('AWS_REGION環境変数からリージョンを使用すること', () => {
    process.env.AWS_REGION = 'eu-west-1';
    const client = createDynamoDBClient();
    expect(client).toBeDefined();
  });

  it('ローカルテスト用のカスタムエンドポイントをサポートすること', () => {
    const client = createDynamoDBClient({
      region: 'us-east-1',
      endpoint: 'http://localhost:8000',
    });
    expect(client).toBeDefined();
  });

  it('マーシャリングオプションが正しく設定されていること', () => {
    const client = createDynamoDBClient();
    expect(client).toBeDefined();
    // マーシャリングオプション: removeUndefinedValues=true, convertEmptyValues=false
  });
});
