/**
 * テストファイルにおける eslint ルールの無効化
 *
 * no-undef: テスト環境では process.env を使用するため無効化
 * no-explicit-any: AWS SDK のモック作成時に any が必要なため無効化
 */
/**
 * Maintenance Coordinator Lambda のテスト
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

import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';

import type { CoordinatorInput } from '../handler.js';
import { lambdaHandler } from '../handler.js';

// AWS SDK のモック
vi.mock('@aws-sdk/client-sfn');

describe('Maintenance Coordinator Lambda', () => {
  beforeEach(() => {
    // 環境変数を設定
    process.env.ENV = 'test';
    process.env.REGION = 'us-east-1';
    process.env.STATE_MACHINE_ARN = 'arn:aws:states:us-east-1:123456789012:stateMachine:test';
    process.env.ALLOW_RESOURCES = 'articles,tasks,fetchLogs';

    // モックをリセット
    vi.clearAllMocks();
  });

  describe('正常系', () => {
    it('Step Functions実行を開始できる', async () => {
      const mockSend = vi.fn().mockResolvedValue({
        executionArn: 'arn:aws:states:us-east-1:123456789012:execution:test:articles-123',
        startDate: new Date('2024-01-01T00:00:00Z'),
      });

      (SFNClient as any).mockImplementation(() => ({
        send: mockSend,
      }));

      const input: CoordinatorInput = {
        resource: 'articles',
        segments: 4,
        dryRun: true,
        pageLimit: 50,
      };

      const result = await lambdaHandler(input);

      expect(result).toEqual({
        executionArn: 'arn:aws:states:us-east-1:123456789012:execution:test:articles-123',
        startDate: '2024-01-01T00:00:00.000Z',
      });

      expect(mockSend).toHaveBeenCalledWith(expect.any(StartExecutionCommand));
    });

    it('デフォルト値が適用される', async () => {
      const mockSend = vi.fn().mockResolvedValue({
        executionArn: 'arn:aws:states:us-east-1:123456789012:execution:test:tasks-456',
        startDate: new Date('2024-01-01T00:00:00Z'),
      });

      (SFNClient as any).mockImplementation(() => ({
        send: mockSend,
      }));

      const input: CoordinatorInput = {
        resource: 'tasks',
      };

      const result = await lambdaHandler(input);

      // 実行が成功することを確認
      expect(result.executionArn).toBeDefined();
      expect(mockSend).toHaveBeenCalledWith(expect.any(StartExecutionCommand));
    });
  });

  describe('バリデーション', () => {
    it('resourceが必須', async () => {
      const input = {} as CoordinatorInput;

      await expect(lambdaHandler(input)).rejects.toThrow('INVALID_INPUT');
    });

    it('resourceが許可リストに含まれていない場合はエラー', async () => {
      const input: CoordinatorInput = {
        resource: 'invalid-resource',
      };

      await expect(lambdaHandler(input)).rejects.toThrow('RESOURCE_NOT_ALLOWED');
    });

    it('segmentsは正の整数でなければならない', async () => {
      const input: CoordinatorInput = {
        resource: 'articles',
        segments: -1,
      };

      await expect(lambdaHandler(input)).rejects.toThrow('INVALID_INPUT');
    });

    it('dryRunはbooleanでなければならない', async () => {
      const input: CoordinatorInput = {
        resource: 'articles',
        dryRun: 'true' as any,
      };

      await expect(lambdaHandler(input)).rejects.toThrow('INVALID_INPUT');
    });

    it('pageLimitは正の整数でなければならない', async () => {
      const input: CoordinatorInput = {
        resource: 'articles',
        pageLimit: 0,
      };

      await expect(lambdaHandler(input)).rejects.toThrow('INVALID_INPUT');
    });
  });

  describe('環境変数', () => {
    it('必須環境変数が不足している場合はエラー', async () => {
      delete process.env.STATE_MACHINE_ARN;

      const input: CoordinatorInput = {
        resource: 'articles',
      };

      await expect(lambdaHandler(input)).rejects.toThrow('CONFIG_ERROR');
    });
  });

  describe('Step Functions エラー', () => {
    it('Step Functions実行開始に失敗した場合はエラー', async () => {
      const mockSend = vi.fn().mockRejectedValue(new Error('SFN execution failed'));

      (SFNClient as any).mockImplementation(() => ({
        send: mockSend,
      }));

      const input: CoordinatorInput = {
        resource: 'articles',
      };

      await expect(lambdaHandler(input)).rejects.toThrow('SFN_ERROR');
    });
  });
});
