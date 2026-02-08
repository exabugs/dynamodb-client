/**
 * DynamoDB Client MCP Server
 * MCPサーバー本体の実装
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { MCPServerConfig } from './types.js';
import { MCPAdapter } from './adapter.js';
import { getAllTools } from './tools/index.js';

/**
 * DynamoDB Client MCPサーバー
 */
export class DynamoDBMCPServer {
  private server: Server;
  private adapter: MCPAdapter;

  constructor(config: MCPServerConfig) {
    // MCPサーバーの初期化
    this.server = new Server(
      {
        name: 'dynamodb-client',
        version: '1.4.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Adapterの初期化
    this.adapter = new MCPAdapter(config);

    // ハンドラーの設定
    this.setupHandlers();
  }

  /**
   * リクエストハンドラーの設定
   */
  private setupHandlers(): void {
    // ツール一覧を返す
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: getAllTools(),
    }));

    // ツールを実行
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        const result = await this.adapter.executeTool(name, args ?? {});

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        return {
          content: [
            {
              type: 'text',
              text: `Error: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  /**
   * サーバーを起動
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}
