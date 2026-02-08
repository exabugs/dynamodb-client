#!/usr/bin/env node

/**
 * DynamoDB Client MCP Server
 * 実行可能スクリプト
 */

// ES Modulesのインポート
import('../dist/mcp/cli.js').catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
