#!/usr/bin/env node

/**
 * DynamoDB Client MCP Server
 * 実行可能スクリプト
 * 
 * このスクリプトは、ビルド後のCLIエントリポイント（dist/mcp/cli.js）を実行します。
 */

import('../dist/mcp/cli.js').catch((error) => {
  console.error('Failed to start DynamoDB MCP Server:', error);
  process.exit(1);
});
