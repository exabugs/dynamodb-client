/**
 * MCP Adapter Layer
 * MCPツール呼び出しを既存のLambda操作に変換
 */
import { randomUUID } from 'node:crypto';
import { createLogger } from '../shared/index.js';
import { executeOperation } from '../server/operations/operationDispatcher.js';
import type { ApiRequest } from '../server/types.js';
import { MCPError, MCPErrorCode, type MCPServerConfig } from './types.js';

/**
 * ロガーインスタンス
 */
const logger = createLogger({
  service: 'mcp-adapter',
  level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
});

/**
 * MCPアダプター
 * MCPツール呼び出しをLambda操作に変換する
 */
export class MCPAdapter {
  constructor(config: MCPServerConfig) {
    // 環境変数を設定（既存のLambda操作が使用）
    if (config.tableName) {
      process.env.DYNAMODB_TABLE = config.tableName;
    }
    if (config.region) {
      process.env.AWS_REGION = config.region;
    }
    if (config.profile) {
      process.env.AWS_PROFILE = config.profile;
    }
    if (config.accessKeyId) {
      process.env.AWS_ACCESS_KEY_ID = config.accessKeyId;
    }
    if (config.secretAccessKey) {
      process.env.AWS_SECRET_ACCESS_KEY = config.secretAccessKey;
    }

    logger.info('MCPAdapter initialized', {
      tableName: config.tableName,
      region: config.region || 'default',
    });
  }

  /**
   * MCPツールを実行
   * @param toolName ツール名
   * @param args ツール引数
   * @returns 実行結果
   */
  async executeTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const requestId = this.generateRequestId();

    logger.debug('Executing MCP tool', {
      requestId,
      toolName,
      args,
    });

    try {
      // MCPツール名をLambda操作に変換
      const apiRequest = this.convertToolToApiRequest(toolName, args);

      // 既存のLambda操作を実行
      const result = await executeOperation(apiRequest, requestId);

      logger.debug('MCP tool executed successfully', {
        requestId,
        toolName,
      });

      return result;
    } catch (error) {
      // エラーを分類して適切なMCPErrorに変換
      const mcpError = this.handleError(error, toolName, requestId);

      logger.error('MCP tool execution failed', {
        requestId,
        toolName,
        errorCode: mcpError.code,
        errorMessage: mcpError.message,
        details: mcpError.details,
      });

      throw mcpError;
    }
  }

  /**
   * エラーを処理してMCPErrorに変換
   * @param error 元のエラー
   * @param toolName ツール名
   * @param requestId リクエストID
   * @returns MCPError
   */
  private handleError(error: unknown, toolName: string, requestId: string): MCPError {
    // すでにMCPErrorの場合はそのまま返す
    if (error instanceof MCPError) {
      return error;
    }

    // Errorオブジェクトの場合
    if (error instanceof Error) {
      // AWS SDK エラーの判定
      if ('name' in error && typeof error.name === 'string') {
        // DynamoDB関連エラー
        if (
          error.name.includes('DynamoDB') ||
          error.name.includes('ResourceNotFound') ||
          error.name.includes('ValidationException')
        ) {
          return new MCPError(MCPErrorCode.DYNAMODB_ERROR, error.message, {
            toolName,
            requestId,
            originalError: error.name,
          });
        }

        // 認証関連エラー
        if (
          error.name.includes('AccessDenied') ||
          error.name.includes('UnauthorizedOperation') ||
          error.name.includes('InvalidClientTokenId') ||
          error.name.includes('SignatureDoesNotMatch')
        ) {
          return new MCPError(MCPErrorCode.AUTHENTICATION_ERROR, error.message, {
            toolName,
            requestId,
            originalError: error.name,
          });
        }
      }

      // パラメータ関連エラー（メッセージから判定）
      if (
        error.message.includes('Missing required parameter') ||
        error.message.includes('required parameter')
      ) {
        return new MCPError(MCPErrorCode.MISSING_REQUIRED_PARAMETER, error.message, {
          toolName,
          requestId,
        });
      }

      if (
        error.message.includes('Invalid parameter') ||
        error.message.includes('invalid')
      ) {
        return new MCPError(MCPErrorCode.INVALID_PARAMETER, error.message, {
          toolName,
          requestId,
        });
      }

      // その他のエラーは内部エラーとして扱う
      return new MCPError(MCPErrorCode.INTERNAL_ERROR, error.message, {
        toolName,
        requestId,
        stack: error.stack,
      });
    }

    // 文字列エラーの場合
    if (typeof error === 'string') {
      return new MCPError(MCPErrorCode.INTERNAL_ERROR, error, {
        toolName,
        requestId,
      });
    }

    // その他の不明なエラー
    return new MCPError(
      MCPErrorCode.INTERNAL_ERROR,
      'An unknown error occurred',
      {
        toolName,
        requestId,
        error: String(error),
      }
    );
  }

  /**
   * MCPツール名をAPIリクエストに変換
   * @param toolName ツール名
   * @param args ツール引数
   * @returns APIリクエスト
   */
  private convertToolToApiRequest(
    toolName: string,
    args: Record<string, unknown>
  ): ApiRequest {
    // ツール名から操作名とリソース名を抽出
    // 例: "dynamodb_find" -> { op: "find", resource: args.collection }
    const toolPrefix = 'dynamodb_';
    
    if (!toolName.startsWith(toolPrefix)) {
      throw new MCPError(
        MCPErrorCode.INVALID_TOOL_NAME,
        `Invalid tool name: ${toolName}. Must start with "${toolPrefix}"`,
        { toolName }
      );
    }

    // ツール名から操作名を抽出（キャメルケース）
    // 例: "dynamodb_findOne" -> "findOne"
    const operationCamelCase = toolName.substring(toolPrefix.length);
    
    // キャメルケースをスネークケースに変換して検証
    // 例: "findOne" -> "find_one"
    const operationSnakeCase = operationCamelCase.replace(/([A-Z])/g, '_$1').toLowerCase();
    
    const resource = args.collection as string;

    if (!resource) {
      throw new MCPError(
        MCPErrorCode.MISSING_REQUIRED_PARAMETER,
        'Missing required parameter: collection',
        { toolName, availableParams: Object.keys(args) }
      );
    }

    // 操作名を検証（スネークケース形式）
    const validOperations = [
      'find',
      'find_one',
      'find_many',
      'find_many_reference',
      'insert_one',
      'insert_many',
      'update_one',
      'update_many',
      'delete_one',
      'delete_many',
    ];

    if (!validOperations.includes(operationSnakeCase)) {
      throw new MCPError(
        MCPErrorCode.INVALID_OPERATION,
        `Unknown operation: ${operationSnakeCase}`,
        { toolName, operation: operationSnakeCase, validOperations }
      );
    }

    // スネークケースをキャメルケースに変換（API呼び出し用）
    // 例: "find_one" -> "findOne"
    const camelCaseOp = operationSnakeCase.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

    // collectionを除いたパラメータを抽出
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { collection: _, ...params } = args;

    return {
      op: camelCaseOp as ApiRequest['op'],
      resource,
      params,
    };
  }

  /**
   * リクエストIDを生成
   * @returns リクエストID
   */
  private generateRequestId(): string {
    return randomUUID();
  }
}
