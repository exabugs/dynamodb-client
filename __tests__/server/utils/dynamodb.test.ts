/**
 * server/utils/dynamodb.ts のユニットテスト
 * DynamoDB操作ユーティリティのテスト
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  executeDynamoDBOperation,
  extractCleanRecord,
  getDBClient,
  getTableName,
  removeShadowKeys,
} from '../../../src/server/utils/dynamodb.js';
import { ConfigError } from '../../../src/shared/index.js';

describe('server/utils/dynamodb', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // 環境変数をリセット
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // 環境変数を復元
    process.env = originalEnv;
  });

  describe('getDBClient', () => {
    it('DynamoDBクライアントを取得できる', () => {
      const client = getDBClient();
      expect(client).toBeDefined();
      expect(client.send).toBeDefined();
    });

    it('シングルトンとして同じインスタンスを返す', () => {
      const client1 = getDBClient();
      const client2 = getDBClient();
      expect(client1).toBe(client2);
    });

    it('AWS_REGION環境変数を使用する', () => {
      process.env.AWS_REGION = 'ap-northeast-1';
      const client = getDBClient();
      expect(client).toBeDefined();
    });

    it('REGION環境変数を使用する', () => {
      delete process.env.AWS_REGION;
      process.env.REGION = 'eu-west-1';
      const client = getDBClient();
      expect(client).toBeDefined();
    });
  });

  describe('getTableName', () => {
    it('TABLE_NAME環境変数からテーブル名を取得できる', () => {
      process.env.TABLE_NAME = 'test-table';
      const tableName = getTableName();
      expect(tableName).toBe('test-table');
    });

    it('TABLE_NAME環境変数が未設定の場合はConfigErrorをスローする', () => {
      delete process.env.TABLE_NAME;
      expect(() => getTableName()).toThrow(ConfigError);
      expect(() => getTableName()).toThrow('TABLE_NAME environment variable is not set');
    });
  });

  describe('removeShadowKeys', () => {
    it('__shadowKeysを除外する', () => {
      const record = {
        id: '123',
        name: 'Test',
        __shadowKeys: ['SK#location#abc', 'SK#status#active'],
      };
      const result = removeShadowKeys(record);
      expect(result).toEqual({ id: '123', name: 'Test' });
      expect(result).not.toHaveProperty('__shadowKeys');
    });

    it('__shadowKeysがない場合はそのまま返す', () => {
      const record = { id: '123', name: 'Test' };
      const result = removeShadowKeys(record);
      expect(result).toEqual({ id: '123', name: 'Test' });
    });

    it('空のオブジェクトを処理できる', () => {
      const record = {};
      const result = removeShadowKeys(record);
      expect(result).toEqual({});
    });
  });

  describe('extractCleanRecord', () => {
    it('data属性からレコードを抽出し__shadowKeysを除外する', () => {
      const item = {
        PK: 'USER#123',
        SK: 'PROFILE',
        data: {
          id: '123',
          name: 'Test User',
          __shadowKeys: ['SK#email#test'],
        },
      };
      const result = extractCleanRecord(item);
      expect(result).toEqual({ id: '123', name: 'Test User' });
      expect(result).not.toHaveProperty('__shadowKeys');
    });

    it('data属性がない場合はitem自体から抽出する', () => {
      const item = {
        id: '123',
        name: 'Test User',
        __shadowKeys: ['SK#email#test'],
      };
      const result = extractCleanRecord(item);
      expect(result).toEqual({ id: '123', name: 'Test User' });
      expect(result).not.toHaveProperty('__shadowKeys');
    });

    it('data属性が空の場合は空オブジェクトを返す', () => {
      const item = {
        PK: 'USER#123',
        SK: 'PROFILE',
        data: {},
      };
      const result = extractCleanRecord(item);
      expect(result).toEqual({});
    });
  });

  describe('executeDynamoDBOperation', () => {
    it('正常な操作を実行できる', async () => {
      const operation = vi.fn().mockResolvedValue({ success: true });
      const result = await executeDynamoDBOperation(operation, 'testOperation');
      expect(result).toEqual({ success: true });
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('AccessDeniedExceptionを適切にハンドリングする', async () => {
      const error = new Error('Access denied');
      error.name = 'AccessDeniedException';
      const operation = vi.fn().mockRejectedValue(error);

      await expect(executeDynamoDBOperation(operation, 'testOperation')).rejects.toThrow(
        'Insufficient permissions to access DynamoDB: testOperation'
      );
    });

    it('その他のエラーはそのまま再スローする', async () => {
      const error = new Error('Some other error');
      const operation = vi.fn().mockRejectedValue(error);

      await expect(executeDynamoDBOperation(operation, 'testOperation')).rejects.toThrow(
        'Some other error'
      );
    });

    it('非Errorオブジェクトのエラーも処理できる', async () => {
      const operation = vi.fn().mockRejectedValue('string error');

      await expect(executeDynamoDBOperation(operation, 'testOperation')).rejects.toBe(
        'string error'
      );
    });
  });
});
