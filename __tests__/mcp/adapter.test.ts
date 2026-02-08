/**
 * MCPAdapter のユニットテスト
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MCPAdapter } from '../../src/mcp/adapter.js';
import type { MCPServerConfig } from '../../src/mcp/types.js';

// executeOperationをモック
vi.mock('../../src/server/operations/operationDispatcher.js', () => ({
  executeOperation: vi.fn(),
}));

describe('MCPAdapter', () => {
  let adapter: MCPAdapter;
  let config: MCPServerConfig;

  beforeEach(() => {
    config = {
      tableName: 'test-table',
      region: 'us-east-1',
    };
    adapter = new MCPAdapter(config);
  });

  describe('constructor', () => {
    it('設定を正しく初期化する', () => {
      expect(process.env.DYNAMODB_TABLE).toBe('test-table');
      expect(process.env.AWS_REGION).toBe('us-east-1');
    });

    it('オプショナルな設定を処理する', () => {
      const fullConfig: MCPServerConfig = {
        tableName: 'test-table',
        region: 'ap-northeast-1',
        profile: 'test-profile',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
      };

      new MCPAdapter(fullConfig);

      expect(process.env.AWS_PROFILE).toBe('test-profile');
      expect(process.env.AWS_ACCESS_KEY_ID).toBe('test-key');
      expect(process.env.AWS_SECRET_ACCESS_KEY).toBe('test-secret');
    });
  });

  describe('executeTool', () => {
    it('dynamodb_findツールを正しく変換して実行する', async () => {
      const { executeOperation } =
        await import('../../src/server/operations/operationDispatcher.js');
      const mockExecuteOperation = vi.mocked(executeOperation);
      mockExecuteOperation.mockResolvedValue({ items: [], pageInfo: {} });

      const args = {
        collection: 'venues',
        filter: { status: 'active' },
      };

      await adapter.executeTool('dynamodb_find', args);

      expect(mockExecuteOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          op: 'find',
          resource: 'venues',
          params: { filter: { status: 'active' } },
        }),
        expect.any(String)
      );
    });

    it('dynamodb_find_oneツールを正しく変換する', async () => {
      const { executeOperation } =
        await import('../../src/server/operations/operationDispatcher.js');
      const mockExecuteOperation = vi.mocked(executeOperation);
      mockExecuteOperation.mockResolvedValue({ id: '123' });

      const args = {
        collection: 'venues',
        id: '123',
      };

      await adapter.executeTool('dynamodb_find_one', args);

      expect(mockExecuteOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          op: 'findOne',
          resource: 'venues',
          params: { id: '123' },
        }),
        expect.any(String)
      );
    });

    it('dynamodb_insert_oneツールを正しく変換する', async () => {
      const { executeOperation } =
        await import('../../src/server/operations/operationDispatcher.js');
      const mockExecuteOperation = vi.mocked(executeOperation);
      mockExecuteOperation.mockResolvedValue({ id: '123', name: 'Test' });

      const args = {
        collection: 'venues',
        data: { name: 'Test' },
      };

      await adapter.executeTool('dynamodb_insert_one', args);

      expect(mockExecuteOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          op: 'insertOne',
          resource: 'venues',
          params: { data: { name: 'Test' } },
        }),
        expect.any(String)
      );
    });

    it('collectionパラメータが欠けている場合はエラーを投げる', async () => {
      await expect(adapter.executeTool('dynamodb_find', {})).rejects.toThrow(
        'Missing required parameter: collection'
      );
    });

    it('無効なツール名の場合はエラーを投げる', async () => {
      await expect(adapter.executeTool('invalid_tool', { collection: 'venues' })).rejects.toThrow(
        'Invalid tool name'
      );
    });

    it('未知の操作の場合はエラーを投げる', async () => {
      await expect(
        adapter.executeTool('dynamodb_unknown_operation', { collection: 'venues' })
      ).rejects.toThrow('Unknown operation');
    });

    it('executeOperationのエラーを正しく伝播する', async () => {
      const { executeOperation } =
        await import('../../src/server/operations/operationDispatcher.js');
      const mockExecuteOperation = vi.mocked(executeOperation);
      mockExecuteOperation.mockRejectedValue(new Error('DynamoDB error'));

      await expect(adapter.executeTool('dynamodb_find', { collection: 'venues' })).rejects.toThrow(
        'DynamoDB error'
      );
    });
  });
});
