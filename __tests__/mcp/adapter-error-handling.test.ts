/**
 * MCP Adapter エラーハンドリングのテスト
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MCPAdapter } from '../../src/mcp/adapter.js';
import { MCPError, MCPErrorCode } from '../../src/mcp/types.js';
import * as operationDispatcher from '../../src/server/operations/operationDispatcher.js';

// executeOperationをモック
vi.mock('../../src/server/operations/operationDispatcher.js', () => ({
  executeOperation: vi.fn(),
}));

describe('MCPAdapter - エラーハンドリング', () => {
  let adapter: MCPAdapter;

  beforeEach(() => {
    adapter = new MCPAdapter({
      tableName: 'test-table',
      region: 'us-east-1',
    });
    vi.clearAllMocks();
  });

  describe('ツール名の検証', () => {
    it('無効なツール名プレフィックスの場合、INVALID_TOOL_NAMEエラーを投げる', async () => {
      await expect(adapter.executeTool('invalid_find', { collection: 'test' })).rejects.toThrow(
        MCPError
      );

      await expect(
        adapter.executeTool('invalid_find', { collection: 'test' })
      ).rejects.toMatchObject({
        code: MCPErrorCode.INVALID_TOOL_NAME,
        message: expect.stringContaining('Invalid tool name'),
      });
    });
  });

  describe('パラメータの検証', () => {
    it('collectionパラメータが欠けている場合、MISSING_REQUIRED_PARAMETERエラーを投げる', async () => {
      await expect(adapter.executeTool('dynamodb_find', {})).rejects.toThrow(MCPError);

      await expect(adapter.executeTool('dynamodb_find', {})).rejects.toMatchObject({
        code: MCPErrorCode.MISSING_REQUIRED_PARAMETER,
        message: expect.stringContaining('Missing required parameter: collection'),
      });
    });
  });

  describe('操作の検証', () => {
    it('無効な操作名の場合、INVALID_OPERATIONエラーを投げる', async () => {
      await expect(
        adapter.executeTool('dynamodb_invalid_operation', { collection: 'test' })
      ).rejects.toThrow(MCPError);

      await expect(
        adapter.executeTool('dynamodb_invalid_operation', { collection: 'test' })
      ).rejects.toMatchObject({
        code: MCPErrorCode.INVALID_OPERATION,
        message: expect.stringContaining('Unknown operation'),
      });
    });
  });

  describe('DynamoDBエラーの処理', () => {
    it('DynamoDBエラーをDYNAMODB_ERRORに変換する', async () => {
      const dynamoError = new Error('ResourceNotFoundException: Table not found');
      dynamoError.name = 'ResourceNotFoundException';

      vi.mocked(operationDispatcher.executeOperation).mockRejectedValue(dynamoError);

      await expect(
        adapter.executeTool('dynamodb_find', { collection: 'test' })
      ).rejects.toMatchObject({
        code: MCPErrorCode.DYNAMODB_ERROR,
        message: expect.stringContaining('Table not found'),
      });
    });
  });

  describe('認証エラーの処理', () => {
    it('AWS認証エラーをAUTHENTICATION_ERRORに変換する', async () => {
      const authError = new Error('AccessDenied: User is not authorized');
      authError.name = 'AccessDenied';

      vi.mocked(operationDispatcher.executeOperation).mockRejectedValue(authError);

      await expect(
        adapter.executeTool('dynamodb_find', { collection: 'test' })
      ).rejects.toMatchObject({
        code: MCPErrorCode.AUTHENTICATION_ERROR,
        message: expect.stringContaining('not authorized'),
      });
    });
  });

  describe('内部エラーの処理', () => {
    it('不明なエラーをINTERNAL_ERRORに変換する', async () => {
      vi.mocked(operationDispatcher.executeOperation).mockRejectedValue(new Error('Unknown error'));

      await expect(
        adapter.executeTool('dynamodb_find', { collection: 'test' })
      ).rejects.toMatchObject({
        code: MCPErrorCode.INTERNAL_ERROR,
        message: 'Unknown error',
      });
    });

    it('文字列エラーをINTERNAL_ERRORに変換する', async () => {
      vi.mocked(operationDispatcher.executeOperation).mockRejectedValue('String error message');

      await expect(
        adapter.executeTool('dynamodb_find', { collection: 'test' })
      ).rejects.toMatchObject({
        code: MCPErrorCode.INTERNAL_ERROR,
        message: 'String error message',
      });
    });
  });

  describe('MCPErrorの詳細情報', () => {
    it('エラーに詳細情報が含まれる', async () => {
      await expect(
        adapter.executeTool('dynamodb_invalid_operation', { collection: 'test' })
      ).rejects.toMatchObject({
        code: MCPErrorCode.INVALID_OPERATION,
        details: {
          toolName: 'dynamodb_invalid_operation',
          operation: 'invalid_operation',
          validOperations: expect.arrayContaining(['find', 'find_one']),
        },
      });
    });
  });

  describe('MCPError.toJSON', () => {
    it('エラーをJSON形式に変換できる', () => {
      const error = new MCPError(MCPErrorCode.INVALID_TOOL_NAME, 'Test error', { detail: 'test' });

      const json = error.toJSON();

      expect(json).toEqual({
        error: {
          code: MCPErrorCode.INVALID_TOOL_NAME,
          message: 'Test error',
          details: { detail: 'test' },
        },
      });
    });
  });
});
