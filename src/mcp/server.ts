/**
 * DynamoDB Client MCP Server
 * MCPサーバー本体の実装
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { createLogger } from '../shared/index.js';
import { MCPAdapter } from './adapter.js';
import { getAllTools } from './tools/index.js';
import { MCPError, type MCPServerConfig } from './types.js';

/**
 * ロガーインスタンス
 */
const logger = createLogger({
  service: 'mcp-server',
  level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
});

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

    logger.info('DynamoDBMCPServer initialized', {
      version: '1.4.0',
    });
  }

  /**
   * リクエストハンドラーの設定
   */
  private setupHandlers(): void {
    // ツール一覧を返す
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      logger.debug('Listing available tools');
      return {
        tools: getAllTools(),
      };
    });

    // ツールを実行
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      logger.debug('Tool call request received', {
        toolName: name,
        hasArguments: !!args,
      });

      try {
        const result = await this.adapter.executeTool(name, args ?? {});

        logger.debug('Tool call succeeded', {
          toolName: name,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('Tool call failed', {
          toolName: name,
          error: error instanceof Error ? error.message : String(error),
        });

        // MCPErrorの場合は詳細情報を含めて返す
        if (error instanceof MCPError) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(error.toJSON(), null, 2),
              },
            ],
            isError: true,
          };
        }

        // その他のエラーは簡潔なメッセージを返す
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: {
                    message: errorMessage,
                  },
                },
                null,
                2
              ),
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
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      logger.info('MCP Server started successfully');
    } catch (error) {
      logger.error('Failed to start MCP Server', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
