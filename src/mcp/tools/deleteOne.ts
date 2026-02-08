/**
 * dynamodb_deleteOne ツール定義
 * DynamoDBから単一レコードを削除します。
 */
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * dynamodb_deleteOne ツール
 * 
 * DynamoDBから単一レコードを削除します。
 */
export const deleteOneTool: Tool = {
  "name": "dynamodb_deleteOne",
  "description": "DynamoDBから単一レコードを削除します。",
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
