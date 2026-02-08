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
