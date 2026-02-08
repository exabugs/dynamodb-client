/**
 * MCP固有型定義
 */

/**
 * MCPサーバー設定
 */
export interface MCPServerConfig {
  /** DynamoDBテーブル名 */
  tableName: string;
  /** AWSリージョン */
  region?: string;
  /** AWSプロファイル */
  profile?: string;
  /** AWSアクセスキーID */
  accessKeyId?: string;
  /** AWSシークレットアクセスキー */
  secretAccessKey?: string;
}

/**
 * MCPエラーコード
 */
export enum MCPErrorCode {
  /** 無効なツール名 */
  INVALID_TOOL_NAME = 'INVALID_TOOL_NAME',
  /** 無効な操作 */
  INVALID_OPERATION = 'INVALID_OPERATION',
  /** 必須パラメータ不足 */
  MISSING_REQUIRED_PARAMETER = 'MISSING_REQUIRED_PARAMETER',
  /** 無効なパラメータ */
  INVALID_PARAMETER = 'INVALID_PARAMETER',
  /** DynamoDB操作エラー */
  DYNAMODB_ERROR = 'DYNAMODB_ERROR',
  /** 認証エラー */
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  /** 内部エラー */
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/**
 * MCPエラー
 */
export class MCPError extends Error {
  constructor(
    public code: MCPErrorCode,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'MCPError';
  }

  /**
   * エラーをJSON形式に変換
   */
  toJSON(): Record<string, unknown> {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    };
  }
}
