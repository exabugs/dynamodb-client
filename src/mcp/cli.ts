/**
 * DynamoDB Client MCP Server CLI
 * CLIエントリポイント
 */
import { DynamoDBMCPServer } from './server.js';

/**
 * 環境変数から設定を取得
 */
function getConfigFromEnv() {
  // 必須パラメータのチェック
  const tableName = process.env.DYNAMODB_TABLE;
  if (!tableName) {
    console.error('Error: DYNAMODB_TABLE environment variable is required');
    process.exit(1);
  }

  // 環境変数から設定を取得
  return {
    tableName,
    region: process.env.AWS_REGION || 'us-east-1',
    profile: process.env.AWS_PROFILE,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };
}

/**
 * メイン関数
 */
async function main(): Promise<void> {
  const config = getConfigFromEnv();

  // MCPサーバーを起動
  const server = new DynamoDBMCPServer(config);
  await server.start();
}

// エラーハンドリング付きで実行
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
