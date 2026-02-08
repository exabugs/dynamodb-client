/**
 * dynamodb_findOne ツール定義
 * DynamoDBから単一レコードを取得します。IDまたはフィルターで指定。
 */
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * dynamodb_findOne ツール
 * 
 * DynamoDBから単一レコードを取得します。IDまたはフィルターで指定。
 */
export const findOneTool: Tool = {
  "name": "dynamodb_findOne",
  "description": "DynamoDBから単一レコードを取得します。IDまたはフィルターで指定。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "collection": {
        "type": "string",
        "description": "コレクション名（例: venues, users）"
      },
      "id": {
        "type": "string",
        "description": "レコードID"
      }
    },
    "required": [
      "collection"
    ]
  }
};
