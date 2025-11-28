/**
 * テストファイルにおける eslint ルールの無効化
 *
 * no-undef: テスト環境では process.env を使用するため無効化
 * no-explicit-any: AWS SDK のモック作成時に any が必要なため無効化
 */
/**
 * Maintenance Worker Lambda のテスト
 *
 * NOTE: テストコードにおける eslint ルールの無効化
 *
 * 以下のルールを無効化しています：
 *
 * 1. no-undef (process.env の使用)
 *    - テストでは環境変数を直接設定する必要がある
 *    - Node.js のグローバル変数 process は TypeScript で型チェック済み
 *
 * 2. @typescript-eslint/no-explicit-any (モックの型定義)
 *    - AWS SDK のモックでは any を使用せざるを得ない
 *    - テストコードでは実用性と可読性を優先
 *    - 実行時の動作確認が目的であり、型安全性よりも保守性を優先
 */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import type { WorkerInput } from '../handler.js';
import { lambdaHandler } from '../handler.js';

// AWS SDK のモック
vi.mock('@aws-sdk/client-dynamodb');
vi.mock('@aws-sdk/lib-dynamodb');

describe('Maintenance Worker Lambda', () => {
  beforeEach(() => {
    // 環境変数を設定
    process.env.ENV = 'test';
    process.env.REGION = 'us-east-1';
    process.env.TABLE_NAME = 'test-table';
    process.env.SHADOW_CONFIG = Buffer.from(
      JSON.stringify({
        $schemaVersion: '2.0',
        database: { name: 'test', timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } },
        resources: {
          articles: {
            sortDefaults: { field: 'updatedAt', order: 'DESC' },
            shadows: {
              name: { type: 'string' },
              updatedAt: { type: 'datetime' },
            },
          },
        },
      })
    ).toString('base64');

    // モックをリセット
    vi.clearAllMocks();
  });

  describe('正常系', () => {
    it('レコードをスキャンして結果を返す', async () => {
      const mockSend = vi.fn().mockResolvedValue({
        Items: [],
        Count: 0,
        ScannedCount: 0,
      });

      (DynamoDBClient as any).mockImplementation(() => ({
        send: mockSend,
      }));

      (DynamoDBDocumentClient as any).from = vi.fn().mockReturnValue({
        send: mockSend,
      });

      const input: WorkerInput = {
        resource: 'articles',
        segment: 0,
        totalSegments: 4,
        dryRun: true,
        pageLimit: 100,
        runId: 'test-run-123',
      };

      const result = await lambdaHandler(input);

      expect(result).toEqual({
        segment: 0,
        scanned: 0,
        drifted: 0,
        repaired: 0,
        failed: 0,
        noop: 0,
        errors: [],
      });

      expect(mockSend).toHaveBeenCalledWith(expect.any(ScanCommand));
    });
  });

  describe('バリデーション', () => {
    it('resourceが必須', async () => {
      const mockSend = vi.fn().mockResolvedValue({
        Items: [],
        Count: 0,
        ScannedCount: 0,
      });

      (DynamoDBClient as any).mockImplementation(() => ({
        send: mockSend,
      }));

      (DynamoDBDocumentClient as any).from = vi.fn().mockReturnValue({
        send: mockSend,
      });

      const input = {
        segment: 0,
        totalSegments: 4,
        dryRun: true,
        pageLimit: 100,
        runId: 'test-run-123',
      } as WorkerInput;

      await expect(lambdaHandler(input)).rejects.toThrow();
    });
  });

  describe('環境変数', () => {
    it('必須環境変数が不足している場合はエラー', async () => {
      delete process.env.TABLE_NAME;

      const input: WorkerInput = {
        resource: 'articles',
        segment: 0,
        totalSegments: 4,
        dryRun: true,
        pageLimit: 100,
        runId: 'test-run-123',
      };

      await expect(lambdaHandler(input)).rejects.toThrow();
    });

    it('SHADOW_CONFIGが不正なBase64の場合はエラー', async () => {
      process.env.SHADOW_CONFIG = 'invalid-base64!!!';

      const input: WorkerInput = {
        resource: 'articles',
        segment: 0,
        totalSegments: 4,
        dryRun: true,
        pageLimit: 100,
        runId: 'test-run-123',
      };

      await expect(lambdaHandler(input)).rejects.toThrow();
    });
  });
});
