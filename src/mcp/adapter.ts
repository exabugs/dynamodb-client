/**
 * MCP Adapter Layer
 * MCPツール呼び出しを既存のLambda操作に変換
 */
import type { MCPServerConfig } from './types.js';

/**
 * MCPアダプター
 * MCPツール呼び出しをLambda操作に変換する
 */
export class MCPAdapter {
  constructor(_config: MCPServerConfig) {
    // TODO: Task 3.1で設定を使用
  }

  /**
   * MCPツールを実行
   * @param toolName ツール名
   * @param _args ツール引数
   * @returns 実行結果
   */
  async executeTool(toolName: string, _args: Record<string, unknown>): Promise<unknown> {
    // TODO: Task 3.1で実装
    throw new Error(`Tool not implemented: ${toolName}`);
  }
}
