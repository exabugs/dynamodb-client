/**
 * dynamodb_findMany ツール定義
 * DynamoDBから複数レコードをIDリストで取得します。
 */
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * dynamodb_findMany ツール
 * 
 * DynamoDBから複数レコードをIDリストで取得します。
 */
export const findManyTool: Tool = {
  "name": "dynamodb_findMany",
  "description": "DynamoDBから複数レコードをIDリストで取得します。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "collection": {
        "type": "string",
        "description": "コレクション名（例: venues, users）"
      },
      "ids": {
        "type": "array",
        "description": "レコードIDの配列",
        "items": {
          "type": "string",
          "description": "itemパラメータ"
        }
      }
    },
    "required": [
      "collection"
    ]
  }
};
