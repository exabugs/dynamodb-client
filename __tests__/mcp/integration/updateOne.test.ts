/**
 * dynamodb_updateOne ツールの統合テスト（簡略版）
 * MCPAdapter経由でupdateOneツールを実行し、基本的なエラーハンドリングを確認
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MCPAdapter } from '../../../src/mcp/adapter.js';
import type { MCPServerConfig } from '../../../src/mcp/types.js';

// DynamoDBクライアントをモック
const mockSend = vi.fn();
const mockClient = {
  send: mockSend,
};

vi.mock('../../../src/shared/index.js', async () => {
  const actual = await vi.importActual('../../../src/shared/index.js');
  return {
    ...actual,
    createDynamoDBClient: vi.fn(() => mockClient),
  };
});

describe('dynamodb_updateOne integration', () => {
  let adapter: MCPAdapter;
  let config: MCPServerConfig;

  beforeEach(() => {
    config = {
      tableName: 'test-table',
      region: 'us-east-1',
    };
    adapter = new MCPAdapter(config);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('エラーハンドリング', () => {
    it('collectionが指定されていない場合、エラーを返す', async () => {
      await expect(
        adapter.executeTool('dynamodb_updateOne', {
          id: 'user1',
          data: { name: 'New Name' },
        })
      ).rejects.toThrow('Missing required parameter: collection');
    });

    it('idまたはfilterが必須', async () => {
      await expect(
        adapter.executeTool('dynamodb_updateOne', {
          collection: 'users',
          data: { name: 'New Name' },
        })
      ).rejects.toThrow();
    });
  });
});
