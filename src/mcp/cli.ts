/**
 * DynamoDB Client MCP Server CLI
 * CLIエントリポイント
 */
import { DynamoDBMCPServer } from './server.js';
import { createLogger } from '../shared/index.js';

/**
 * ロガーインスタンス
 */
const logger = createLogger({
  service: 'mcp-cli',
  level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
});

/**
 * 環境変数から設定を取得
 */
function getConfigFromEnv() {
  // 必須パラメータのチェック
  const tableName = process.env.DYNAMODB_TABLE;
  if (!tableName) {
    const errorMessage = 'DYNAMODB_TABLE environment variable is required';
    logger.error(errorMessage);
    console.error(`Error: ${errorMessage}`);
    console.error('\nUsage:');
    console.error('  DYNAMODB_TABLE=your-table-name npx @exabugs/dynamodb-client mcp');
    console.error('\nOptional environment variables:');
    console.error('  AWS_REGION (default: us-east-1)');
    console.error('  AWS_PROFILE');
    console.error('  AWS_ACCESS_KEY_ID');
    console.error('  AWS_SECRET_ACCESS_KEY');
    console.error('  LOG_LEVEL (debug|info|warn|error, default: info)');
    process.exit(1);
  }

  // 環境変数から設定を取得
  const config = {
    tableName,
    region: process.env.AWS_REGION || 'us-east-1',
    profile: process.env.AWS_PROFILE,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };

  logger.debug('Configuration loaded from environment', {
    tableName: config.tableName,
    region: config.region,
    hasProfile: !!config.profile,
    hasAccessKey: !!config.accessKeyId,
  });

  return config;
}

/**
 * メイン関数
 */
async function main(): Promise<void> {
  try {
    logger.info('Starting DynamoDB Client MCP Server');

    const config = getConfigFromEnv();

    // MCPサーバーを起動
    const server = new DynamoDBMCPServer(config);
    await server.start();

    logger.info('MCP Server is running');
  } catch (error) {
    logger.error('Failed to start MCP Server', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // ユーザーフレンドリーなエラーメッセージを表示
    console.error('\nFatal error occurred:');
    if (error instanceof Error) {
      console.error(`  ${error.message}`);
      
      // AWS認証エラーの場合は追加のヘルプを表示
      if (
        error.message.includes('credentials') ||
        error.message.includes('AccessDenied') ||
        error.message.includes('UnauthorizedOperation')
      ) {
        console.error('\nAWS authentication failed. Please check:');
        console.error('  1. AWS credentials are configured correctly');
        console.error('  2. AWS_PROFILE is set (if using profiles)');
        console.error('  3. AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set (if using keys)');
        console.error('  4. IAM permissions allow DynamoDB access');
      }

      // DynamoDBテーブルエラーの場合
      if (
        error.message.includes('ResourceNotFound') ||
        error.message.includes('Table')
      ) {
        console.error('\nDynamoDB table not found. Please check:');
        console.error('  1. DYNAMODB_TABLE is set correctly');
        console.error('  2. The table exists in the specified region');
        console.error('  3. AWS_REGION is set correctly');
      }
    } else {
      console.error(`  ${String(error)}`);
    }

    process.exit(1);
  }
}

// プロセス終了時のクリーンアップ
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

// 未処理のPromise拒否をキャッチ
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    promise: String(promise),
  });
  console.error('\nUnhandled Promise Rejection:');
  console.error(reason);
  process.exit(1);
});

// エラーハンドリング付きで実行
main().catch((error) => {
  logger.error('Unexpected error in main', {
    error: error instanceof Error ? error.message : String(error),
  });
  console.error('Fatal error:', error);
  process.exit(1);
});
